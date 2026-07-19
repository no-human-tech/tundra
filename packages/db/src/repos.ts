/**
 * Typed repository functions over the Drizzle client.
 *
 * These are the data-access boundary the API and worker consume. They compose
 * the pure mappers (`mappers.ts`) and the pure domain logic (`@tundra/domain`)
 * with concrete queries. The domain remains the authority for aggregation
 * (`selectMyTasks`) and revert authorization (`canRevertAction`); these
 * functions only fetch the rows those decisions need and persist the results.
 *
 * The audit log is append-only: `insertAuditEvent` only inserts, and
 * `revertAuditEvent` records a new compensating event rather than mutating the
 * original.
 */

import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";

import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";

/**
 * Async wrapper for `crypto.scrypt` that passes custom scrypt parameters.
 * `util.promisify(scrypt)` only handles the 3-arg form, so we use an explicit
 * Promise to keep the options support that scrypt requires for security.
 */
function scryptDeriveKey(
	password: string,
	salt: Buffer,
	keylen: number,
	N: number,
	r: number,
	p: number,
): Promise<Buffer> {
	return new Promise<Buffer>((resolve, reject) => {
		// Node's default maxmem (32 MB) is too small for N=65536, r=8 (needs ~64 MB).
		// Use 256 MB so the boundary condition is never tight regardless of p.
		const maxmem = 256 * 1024 * 1024;
		scrypt(password, salt, keylen, { N, r, p, maxmem }, (err, key) => {
			if (err) reject(err);
			else resolve(key);
		});
	});
}

import type {
	AuditEvent,
	AuditEventId,
	Project,
	ProjectId,
	ProjectRole,
	RevertDecision,
	SessionPrincipal,
	User,
	UserId,
	WorkItem,
	WorkItemId,
	WorkItemStatus,
	WorkspaceId,
	WorkspaceRole,
} from "@tundra/domain";
import {
	ActionSource,
	Reversibility,
	RevertDenyReason,
	canRevertAction,
	makeReversalEvent,
	permissionsForProjectRole,
	permissionsForWorkspaceRole,
	selectMyTasks,
} from "@tundra/domain";

import type { DbClient } from "./client.js";
import {
	auditEventToInsert,
	rowToAuditEvent,
	rowToProject,
	rowToUser,
	rowToWorkItem,
	workItemToInsert,
} from "./mappers.js";
import {
	auditEvents,
	externalIdentities,
	integrationOutbox,
	projectMembers,
	projects,
	sessions,
	users,
	workItems,
	workspaceMemberships,
} from "./schema/tables.js";

// --- Reads --------------------------------------------------------------------

/** Load a single user by id, or `null` when none exists. */
export async function getUser(db: DbClient, userId: string): Promise<User | null> {
	const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
	const row = rows[0];
	return row ? rowToUser(row) : null;
}

/**
 * List projects, optionally narrowed to a single workspace. Ordered by id for a
 * stable result.
 */
export async function listProjects(db: DbClient, workspaceId?: string): Promise<Project[]> {
	const rows = workspaceId
		? await db
				.select()
				.from(projects)
				.where(eq(projects.workspaceId, workspaceId))
				.orderBy(asc(projects.id))
		: await db.select().from(projects).orderBy(asc(projects.id));
	return rows.map(rowToProject);
}

/** Load a single project by id, or `null` when none exists. */
export async function getProject(db: DbClient, id: string): Promise<Project | null> {
	const rows = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
	const row = rows[0];
	return row ? rowToProject(row) : null;
}

/** Load a single work item by id, or `null` when none exists. */
export async function getWorkItem(db: DbClient, id: string): Promise<WorkItem | null> {
	const rows = await db.select().from(workItems).where(eq(workItems.id, id)).limit(1);
	const row = rows[0];
	return row ? rowToWorkItem(row) : null;
}

/**
 * Build the resolved {@link SessionPrincipal} for a user: their workspace role
 * and the permissions it grants, plus their per-project roles and the union of
 * the permissions those grant. Returns `null` when the user does not exist.
 *
 * The principal is constructed for the user's (single) workspace membership in
 * this slice. `source` is {@link ActionSource.User}.
 */
export async function loadSessionPrincipal(
	db: DbClient,
	userId: string,
): Promise<SessionPrincipal | null> {
	const user = await getUser(db, userId);
	if (!user) {
		return null;
	}

	const membershipRows = await db
		.select()
		.from(workspaceMemberships)
		.where(eq(workspaceMemberships.userId, userId))
		.orderBy(asc(workspaceMemberships.id))
		.limit(1);
	const membership = membershipRows[0];

	const projectRoleRows = await db
		.select()
		.from(projectMembers)
		.where(eq(projectMembers.userId, userId));

	const projectRoles: Record<string, ProjectRole> = {};
	const permissions = new Set<string>();

	if (membership) {
		for (const permission of permissionsForWorkspaceRole(membership.role as WorkspaceRole)) {
			permissions.add(permission);
		}
	}

	for (const row of projectRoleRows) {
		const role = row.role as ProjectRole;
		projectRoles[row.projectId] = role;
		for (const permission of permissionsForProjectRole(role)) {
			permissions.add(permission);
		}
	}

	return {
		userId: user.id,
		source: ActionSource.User,
		workspaceId: membership ? (membership.workspaceId as WorkspaceId) : undefined,
		workspaceRole: membership ? (membership.role as WorkspaceRole) : undefined,
		projectRoles,
		permissions: [...permissions],
	};
}

/** Optional narrowing applied on top of the assignee filter for My Tasks. */
export interface MyTasksRepoFilter {
	projectId?: ProjectId;
	includeStatuses?: WorkItemStatus[];
	sources?: WorkItem["source"][];
}

/**
 * Select a user's "My Tasks": load the candidate work items assigned to them and
 * hand them to the domain `selectMyTasks`, which stays the aggregation authority.
 */
export async function selectMyTasksForUser(
	db: DbClient,
	userId: string,
	filter?: MyTasksRepoFilter,
): Promise<WorkItem[]> {
	const rows = await db
		.select()
		.from(workItems)
		.where(eq(workItems.assigneeId, userId))
		.orderBy(asc(workItems.id));
	const items = rows.map(rowToWorkItem);
	return selectMyTasks(items, {
		assigneeId: userId as UserId,
		projectId: filter?.projectId,
		includeStatuses: filter?.includeStatuses,
		sources: filter?.sources,
	});
}

// --- Audit log (append-only) --------------------------------------------------

/** Topic for WorkItem lifecycle events on the integration bus. */
const TOPIC_WORKITEM_EVENTS = "tundra.events.workitem";
/** Topic for all other audit-derived events on the integration bus. */
const TOPIC_AUDIT_EVENTS = "tundra.events.audit";

/**
 * Insert an audit event and return the persisted (re-read) domain event.
 *
 * Every audit event also enqueues an integration-outbox row (the audit log IS
 * the domain-event stream): WorkItem events go to `tundra.events.workitem`,
 * everything else to `tundra.events.audit`. The worker relays outbox rows to
 * Redpanda; deployments without a bus simply accumulate-and-ignore nothing —
 * rows still get written but no relay runs, which keeps the write path
 * identical across profiles.
 */
export async function insertAuditEvent(db: DbClient, event: AuditEvent): Promise<AuditEvent> {
	const [row] = await db.insert(auditEvents).values(auditEventToInsert(event)).returning();
	if (!row) {
		throw new Error("insertAuditEvent: insert returned no row");
	}
	const persisted = rowToAuditEvent(row);

	await enqueueOutboxEvent(db, {
		topic: event.targetType === "WorkItem" ? TOPIC_WORKITEM_EVENTS : TOPIC_AUDIT_EVENTS,
		key: event.targetId,
		payload: {
			kind: "audit-event",
			event: persisted as unknown as Record<string, unknown>,
		},
	});

	return persisted;
}

// --- Integration outbox ---------------------------------------------------------

/** A message to enqueue on the integration outbox. */
export interface OutboxMessage {
	/** Destination topic, e.g. `tundra.events.workitem`. */
	topic: string;
	/** Kafka message key (partitioning); null for round-robin. */
	key?: string | null;
	payload: Record<string, unknown>;
}

/** One pending/published outbox row as read back for the relay. */
export interface OutboxRow {
	id: string;
	topic: string;
	key: string | null;
	payload: Record<string, unknown>;
	attempts: number;
}

/** Enqueue an outbox row (call within the same flow as the domain write). */
export async function enqueueOutboxEvent(db: DbClient, message: OutboxMessage): Promise<string> {
	const id = `out_${randomUUID()}`;
	await db.insert(integrationOutbox).values({
		id,
		topic: message.topic,
		key: message.key ?? null,
		payload: message.payload,
	});
	return id;
}

/** Oldest-first unpublished outbox rows, up to `limit`. */
export async function selectPendingOutbox(db: DbClient, limit: number): Promise<OutboxRow[]> {
	const rows = await db
		.select({
			id: integrationOutbox.id,
			topic: integrationOutbox.topic,
			key: integrationOutbox.key,
			payload: integrationOutbox.payload,
			attempts: integrationOutbox.attempts,
		})
		.from(integrationOutbox)
		.where(isNull(integrationOutbox.publishedAt))
		.orderBy(asc(integrationOutbox.createdAt))
		.limit(limit);
	return rows;
}

/** Stamp rows as published after the bus confirmed the produce. */
export async function markOutboxPublished(db: DbClient, ids: readonly string[]): Promise<void> {
	if (ids.length === 0) {
		return;
	}
	await db
		.update(integrationOutbox)
		.set({ publishedAt: new Date().toISOString() })
		.where(inArray(integrationOutbox.id, [...ids]));
}

/** Record a failed relay attempt (row stays pending and will be retried). */
export async function markOutboxFailed(db: DbClient, id: string, error: string): Promise<void> {
	await db
		.update(integrationOutbox)
		.set({ attempts: sql`${integrationOutbox.attempts} + 1`, lastError: error.slice(0, 1000) })
		.where(eq(integrationOutbox.id, id));
}

/**
 * Load the audit history for a target, oldest first. Includes both primary and
 * compensating (revert) events for the target.
 */
export async function getAuditHistory(
	db: DbClient,
	targetType: string,
	targetId: string,
): Promise<AuditEvent[]> {
	const rows = await db
		.select()
		.from(auditEvents)
		.where(and(eq(auditEvents.targetType, targetType), eq(auditEvents.targetId, targetId)))
		.orderBy(asc(auditEvents.occurredAt), asc(auditEvents.id));
	return rows.map(rowToAuditEvent);
}

/** Whether a compensating event already exists for the given event id. */
export async function isEventReverted(db: DbClient, eventId: string): Promise<boolean> {
	const rows = await db
		.select({ id: auditEvents.id })
		.from(auditEvents)
		.where(eq(auditEvents.reversalOfEventId, eventId))
		.limit(1);
	return rows.length > 0;
}

// --- Reversible action PoC: work-item status change ---------------------------

/** Result of {@link changeWorkItemStatus} when the work item exists. */
export interface ChangeWorkItemStatusOk {
	workItem: WorkItem;
	event: AuditEvent;
}

/**
 * Change a work item's status and record an append-only, reversible audit event.
 *
 * The event captures `before`/`after`/`inverse` status snapshots so the change
 * can later be undone via {@link revertAuditEvent}. Returns `{ error }` when the
 * work item does not exist.
 */
export async function changeWorkItemStatus(
	db: DbClient,
	args: { workItemId: string; status: WorkItemStatus; principal: SessionPrincipal },
): Promise<ChangeWorkItemStatusOk | { error: "not_found" }> {
	const existing = await getWorkItem(db, args.workItemId);
	if (!existing) {
		return { error: "not_found" };
	}

	const oldStatus = existing.status;
	const now = new Date().toISOString();

	const [updatedRow] = await db
		.update(workItems)
		.set({ status: args.status, updatedAt: now })
		.where(eq(workItems.id, args.workItemId))
		.returning();
	if (!updatedRow) {
		return { error: "not_found" };
	}
	const workItem = rowToWorkItem(updatedRow);

	const event: AuditEvent = {
		id: `evt_${randomUUID()}` as AuditEventId,
		createdAt: now,
		updatedAt: now,
		occurredAt: now,
		actorUserId: args.principal.userId,
		source: args.principal.source,
		workspaceId: undefined,
		projectId: existing.projectId,
		action: "workitem.status_changed",
		targetType: "WorkItem",
		targetId: existing.id,
		before: { status: oldStatus },
		after: { status: args.status },
		inverse: { status: oldStatus },
		reversibility: Reversibility.Reversible,
	};

	const persisted = await insertAuditEvent(db, event);
	return { workItem, event: persisted };
}

// --- Revert -------------------------------------------------------------------

/**
 * Attempt to revert an audit event. Loads the event, derives revert facts
 * (already-reverted, dependent later changes to the same target), and asks the
 * domain `canRevertAction`. When allowed, applies the inverse and records a
 * compensating event; the original event is never mutated or deleted.
 */
export async function revertAuditEvent(
	db: DbClient,
	args: { eventId: string; principal: SessionPrincipal },
): Promise<RevertDecision & { event?: AuditEvent }> {
	const rows = await db.select().from(auditEvents).where(eq(auditEvents.id, args.eventId)).limit(1);
	const row = rows[0];
	if (!row) {
		return {
			allowed: false,
			reason: RevertDenyReason.NotFound,
			message: "Cannot revert: the audit event was not found",
		};
	}
	const original = rowToAuditEvent(row);

	const alreadyReverted = await isEventReverted(db, original.id);

	// Dependent events: later changes to the same target by a different event.
	const targetHistory = await getAuditHistory(db, original.targetType, original.targetId);
	const dependentEvents = targetHistory.filter(
		(e) =>
			e.id !== original.id &&
			e.reversalOfEventId === undefined &&
			e.occurredAt > original.occurredAt,
	);

	const decision = canRevertAction({
		principal: args.principal,
		event: original,
		alreadyReverted,
		dependentEvents,
	});

	if (!decision.allowed) {
		return decision;
	}

	// Apply the inverse. The only reversible action in this slice is a work-item
	// status change, whose inverse is { status }.
	if (original.action === "workitem.status_changed") {
		const inverse = decision.plan.inverse as { status?: WorkItemStatus } | undefined;
		if (inverse?.status !== undefined) {
			await db
				.update(workItems)
				.set({ status: inverse.status, updatedAt: new Date().toISOString() })
				.where(eq(workItems.id, original.targetId));
		}
	}

	const compensating = makeReversalEvent({
		plan: decision.plan,
		principal: args.principal,
		original,
		id: `evt_${randomUUID()}` as AuditEventId,
		occurredAt: new Date().toISOString(),
	});
	const persisted = await insertAuditEvent(db, compensating);

	return { allowed: true, plan: decision.plan, event: persisted };
}

// --- Provider reconciliation (worker) -----------------------------------------

/**
 * Idempotently upsert provider-supplied work items for a project. Used by the
 * worker to reconcile a module's WorkItem provider output. Returns how many rows
 * were inserted or updated.
 */
export async function reconcileProviderWorkItems(
	db: DbClient,
	projectId: string,
	items: WorkItem[],
): Promise<{ upserted: number }> {
	let upserted = 0;
	for (const item of items) {
		const insert = workItemToInsert({ ...item, projectId: projectId as ProjectId });
		await db
			.insert(workItems)
			.values(insert)
			.onConflictDoUpdate({
				target: workItems.id,
				set: {
					projectId: insert.projectId,
					source: insert.source,
					sourceRef: insert.sourceRef,
					title: insert.title,
					status: insert.status,
					priority: insert.priority,
					assigneeId: insert.assigneeId,
					dueDate: insert.dueDate,
					sprintId: insert.sprintId,
					metadata: insert.metadata,
					updatedAt: new Date().toISOString(),
				},
			});
		upserted += 1;
	}
	return { upserted };
}

// --- WorkItem mutations -------------------------------------------------------

/** Input for creating a new work item. */
export interface CreateWorkItemInput {
	projectId: string;
	title: string;
	source: WorkItem["source"];
	priority: WorkItem["priority"];
	assigneeId?: string;
	dueDate?: string;
}

/**
 * Create a new work item and record an append-only audit event.
 *
 * Returns the created {@link WorkItem} and the audit event id.
 */
export async function createWorkItem(
	db: DbClient,
	args: { input: CreateWorkItemInput; principal: SessionPrincipal },
): Promise<{ workItem: WorkItem; eventId: string }> {
	const now = new Date().toISOString();
	const id = `wi_${randomUUID()}`;

	const sourceRef = { source: args.input.source, refId: id };
	const insert = workItemToInsert({
		id: id as WorkItemId,
		projectId: args.input.projectId as ProjectId,
		source: args.input.source,
		sourceRef,
		title: args.input.title,
		status: "todo" as WorkItem["status"],
		priority: args.input.priority,
		assigneeId: args.input.assigneeId ? (args.input.assigneeId as UserId) : undefined,
		dueDate: args.input.dueDate,
		createdAt: now,
		updatedAt: now,
	});

	const [row] = await db.insert(workItems).values(insert).returning();
	if (!row) {
		throw new Error("createWorkItem: insert returned no row");
	}
	const workItem = rowToWorkItem(row);

	const event: AuditEvent = {
		id: `evt_${randomUUID()}` as AuditEventId,
		createdAt: now,
		updatedAt: now,
		occurredAt: now,
		actorUserId: args.principal.userId,
		source: args.principal.source,
		workspaceId: undefined,
		projectId: args.input.projectId as ProjectId,
		action: "workitem.created",
		targetType: "WorkItem",
		targetId: id,
		after: { title: args.input.title, status: "todo", priority: args.input.priority },
		reversibility: Reversibility.Irreversible,
		irreversibleReason: "Creation events cannot be reversed via the revert mechanism",
	};
	const persisted = await insertAuditEvent(db, event);
	return { workItem, eventId: persisted.id };
}

/** Fields that can be updated on a WorkItem. All optional except the target id. */
export interface UpdateWorkItemInput {
	title?: string;
	priority?: WorkItem["priority"];
	assigneeId?: string | null;
	dueDate?: string | null;
}

/**
 * Update mutable fields on a work item. Status changes should use
 * {@link changeWorkItemStatus} to ensure the reversible audit trail is recorded.
 *
 * Returns `{ error: "not_found" }` when no work item with the given id exists.
 */
export async function updateWorkItem(
	db: DbClient,
	args: {
		workItemId: string;
		input: UpdateWorkItemInput;
		principal: SessionPrincipal;
	},
): Promise<{ workItem: WorkItem; eventId: string } | { error: "not_found" }> {
	const existing = await getWorkItem(db, args.workItemId);
	if (!existing) {
		return { error: "not_found" };
	}

	const now = new Date().toISOString();
	const before: Record<string, unknown> = {};
	const after: Record<string, unknown> = {};

	const setPatch: {
		updatedAt: string;
		title?: string;
		priority?: WorkItem["priority"];
		assigneeId?: string | null;
		dueDate?: string | null;
	} = { updatedAt: now };

	if (args.input.title !== undefined && args.input.title !== existing.title) {
		before["title"] = existing.title;
		after["title"] = args.input.title;
		setPatch.title = args.input.title;
	}
	if (args.input.priority !== undefined && args.input.priority !== existing.priority) {
		before["priority"] = existing.priority;
		after["priority"] = args.input.priority;
		setPatch.priority = args.input.priority;
	}
	if ("assigneeId" in args.input && args.input.assigneeId !== (existing.assigneeId ?? null)) {
		before["assigneeId"] = existing.assigneeId ?? null;
		after["assigneeId"] = args.input.assigneeId ?? null;
		setPatch.assigneeId = args.input.assigneeId ?? null;
	}
	if ("dueDate" in args.input && args.input.dueDate !== (existing.dueDate ?? null)) {
		before["dueDate"] = existing.dueDate ?? null;
		after["dueDate"] = args.input.dueDate ?? null;
		setPatch.dueDate = args.input.dueDate ?? null;
	}

	const [updatedRow] = await db
		.update(workItems)
		.set(setPatch)
		.where(eq(workItems.id, args.workItemId))
		.returning();
	if (!updatedRow) {
		return { error: "not_found" };
	}
	const workItem = rowToWorkItem(updatedRow);

	const event: AuditEvent = {
		id: `evt_${randomUUID()}` as AuditEventId,
		createdAt: now,
		updatedAt: now,
		occurredAt: now,
		actorUserId: args.principal.userId,
		source: args.principal.source,
		workspaceId: undefined,
		projectId: existing.projectId,
		action: "workitem.updated",
		targetType: "WorkItem",
		targetId: existing.id,
		before,
		after,
		reversibility: Reversibility.Irreversible,
		irreversibleReason: "General field updates are not reversible via the revert mechanism",
	};
	const persisted = await insertAuditEvent(db, event);
	return { workItem, eventId: persisted.id };
}

// --- Workspace member admin --------------------------------------------------

/** A simplified member row for the admin panel. */
export interface WorkspaceMemberRow {
	userId: string;
	displayName: string;
	primaryEmail: string;
	role: WorkspaceRole;
	joinedAt: string;
}

/**
 * List all workspace members with their current role, ordered by join date.
 * Used by the admin panel.
 */
export async function listWorkspaceMembers(
	db: DbClient,
	workspaceId: string,
): Promise<WorkspaceMemberRow[]> {
	const rows = await db
		.select({
			userId: workspaceMemberships.userId,
			role: workspaceMemberships.role,
			joinedAt: workspaceMemberships.joinedAt,
			displayName: users.displayName,
			primaryEmail: users.primaryEmail,
		})
		.from(workspaceMemberships)
		.innerJoin(users, eq(workspaceMemberships.userId, users.id))
		.where(eq(workspaceMemberships.workspaceId, workspaceId))
		.orderBy(asc(workspaceMemberships.joinedAt));

	return rows.map((r) => ({
		userId: r.userId,
		displayName: r.displayName,
		primaryEmail: r.primaryEmail,
		role: r.role as WorkspaceRole,
		joinedAt: r.joinedAt ?? new Date().toISOString(),
	}));
}

/**
 * Change a workspace member's role, recording an append-only audit event.
 *
 * Prevents demoting the last admin/owner: if the user is the only remaining
 * admin/owner, the mutation is rejected with `{ error: "last_admin" }`.
 *
 * Returns `{ error: "not_found" }` when the membership does not exist.
 */
export async function changeWorkspaceMemberRole(
	db: DbClient,
	args: {
		workspaceId: string;
		targetUserId: string;
		newRole: WorkspaceRole;
		principal: SessionPrincipal;
	},
): Promise<{ eventId: string } | { error: "not_found" | "last_admin" }> {
	const membershipRows = await db
		.select()
		.from(workspaceMemberships)
		.where(
			and(
				eq(workspaceMemberships.workspaceId, args.workspaceId),
				eq(workspaceMemberships.userId, args.targetUserId),
			),
		)
		.limit(1);
	const membership = membershipRows[0];
	if (!membership) {
		return { error: "not_found" };
	}

	const oldRole = membership.role as WorkspaceRole;

	// Guard: do not demote the last admin/owner.
	if (
		(oldRole === "admin" || oldRole === "owner") &&
		args.newRole !== "admin" &&
		args.newRole !== "owner"
	) {
		const adminRows = await db
			.select({ id: workspaceMemberships.id })
			.from(workspaceMemberships)
			.where(
				and(
					eq(workspaceMemberships.workspaceId, args.workspaceId),
					eq(workspaceMemberships.role, oldRole),
				),
			);
		if (adminRows.length <= 1) {
			return { error: "last_admin" };
		}
	}

	const now = new Date().toISOString();
	await db
		.update(workspaceMemberships)
		.set({ role: args.newRole })
		.where(
			and(
				eq(workspaceMemberships.workspaceId, args.workspaceId),
				eq(workspaceMemberships.userId, args.targetUserId),
			),
		);

	const event: AuditEvent = {
		id: `evt_${randomUUID()}` as AuditEventId,
		createdAt: now,
		updatedAt: now,
		occurredAt: now,
		actorUserId: args.principal.userId,
		source: args.principal.source,
		workspaceId: args.workspaceId as WorkspaceId,
		projectId: undefined,
		action: "member.role_changed",
		targetType: "WorkspaceMembership",
		targetId: membership.id,
		before: { role: oldRole },
		after: { role: args.newRole },
		reversibility: Reversibility.Reversible,
		inverse: { role: oldRole },
	};
	const persisted = await insertAuditEvent(db, event);
	return { eventId: persisted.id };
}

// --- Auth: password credentials and sessions ---------------------------------

/** Scrypt parameters for password hashing. */
const SCRYPT_N = 65536;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LEN = 64;
const SALT_BYTES = 16;
/** Session token lifetime: 7 days in milliseconds. */
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Hash a plaintext password with scrypt + random salt.
 *
 * The returned string has the format `${saltHex}:${hashHex}` and is safe to
 * store in `external_identities.credential_hash`.
 */
export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(SALT_BYTES);
	const hash = await scryptDeriveKey(password, salt, SCRYPT_KEY_LEN, SCRYPT_N, SCRYPT_R, SCRYPT_P);
	return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

/**
 * Verify a plaintext password against a stored scrypt hash string.
 *
 * Uses a timing-safe comparison to prevent timing-based enumeration.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	const colonIdx = stored.indexOf(":");
	if (colonIdx < 0) {
		return false;
	}
	const saltHex = stored.slice(0, colonIdx);
	const hashHex = stored.slice(colonIdx + 1);
	const salt = Buffer.from(saltHex, "hex");
	const expected = Buffer.from(hashHex, "hex");
	const actual = await scryptDeriveKey(
		password,
		salt,
		SCRYPT_KEY_LEN,
		SCRYPT_N,
		SCRYPT_R,
		SCRYPT_P,
	);
	if (actual.length !== expected.length) {
		return false;
	}
	return timingSafeEqual(actual, expected);
}

/** Produce the SHA-256 hex digest of a raw session token. */
function hashToken(raw: string): string {
	return createHash("sha256").update(raw).digest("hex");
}

/** Result of a successful {@link registerUser} call. */
export interface RegisterResult {
	userId: string;
	sessionToken: string;
}

/**
 * Register a new user with the email provider, create their workspace
 * membership, and open a new session.
 *
 * Returns `{ error: "email_taken" }` when the normalised email is already
 * registered. The caller must set the session cookie from `sessionToken`.
 */
export async function registerUser(
	db: DbClient,
	args: {
		email: string;
		password: string;
		displayName: string;
		workspaceId: string;
	},
): Promise<RegisterResult | { error: "email_taken" }> {
	const email = args.email.toLowerCase().trim();

	// Check for existing user with this email.
	const existing = await db
		.select({ id: users.id })
		.from(users)
		.where(eq(users.primaryEmail, email))
		.limit(1);
	if (existing.length > 0) {
		return { error: "email_taken" };
	}

	const now = new Date().toISOString();
	const userId = `user_${randomUUID()}`;
	const credentialHash = await hashPassword(args.password);

	await db.insert(users).values({
		id: userId,
		primaryEmail: email,
		emailVerified: false,
		displayName: args.displayName,
		status: "active",
		createdAt: now,
		updatedAt: now,
	});

	await db.insert(externalIdentities).values({
		id: `ext_${randomUUID()}`,
		userId,
		providerId: "email",
		subject: email,
		email,
		emailVerified: false,
		linkedAt: now,
		credentialHash,
	});

	await db.insert(workspaceMemberships).values({
		id: `wsm_${randomUUID()}`,
		workspaceId: args.workspaceId,
		userId,
		role: "member",
		joinedAt: now,
	});

	const sessionToken = randomBytes(32).toString("hex");
	const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
	await db.insert(sessions).values({
		id: `sess_${randomUUID()}`,
		userId,
		tokenHash: hashToken(sessionToken),
		expiresAt,
	});

	return { userId, sessionToken };
}

/** Result of a successful {@link loginUser} call. */
export interface LoginResult {
	userId: string;
	sessionToken: string;
}

/**
 * Authenticate with email + password, open a new session, and return the raw
 * session token. Returns a stable error code on failure so the API can return
 * an i18n-friendly message without leaking which field was wrong.
 *
 * The caller must set the session cookie from `sessionToken`.
 */
export async function loginUser(
	db: DbClient,
	args: { email: string; password: string },
): Promise<LoginResult | { error: "invalid_credentials" | "user_suspended" }> {
	const email = args.email.toLowerCase().trim();

	const identityRows = await db
		.select({
			userId: externalIdentities.userId,
			credentialHash: externalIdentities.credentialHash,
		})
		.from(externalIdentities)
		.where(and(eq(externalIdentities.providerId, "email"), eq(externalIdentities.subject, email)))
		.limit(1);
	const identity = identityRows[0];
	if (!identity || !identity.credentialHash) {
		// Run a dummy hash to prevent timing-based email enumeration.
		await hashPassword("__dummy__").catch(() => undefined);
		return { error: "invalid_credentials" };
	}

	const valid = await verifyPassword(args.password, identity.credentialHash);
	if (!valid) {
		return { error: "invalid_credentials" };
	}

	// Check the user's status.
	const userRows = await db
		.select({ status: users.status })
		.from(users)
		.where(eq(users.id, identity.userId))
		.limit(1);
	const user = userRows[0];
	if (!user || (user.status !== "active" && user.status !== "invited")) {
		return { error: "user_suspended" };
	}

	const sessionToken = randomBytes(32).toString("hex");
	const now = new Date().toISOString();
	const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
	await db.insert(sessions).values({
		id: `sess_${randomUUID()}`,
		userId: identity.userId,
		tokenHash: hashToken(sessionToken),
		createdAt: now,
		expiresAt,
	});

	return { userId: identity.userId, sessionToken };
}

/**
 * Look up an active (not invalidated, not expired) session by raw token and
 * return the user id, or `null` when the token is invalid or expired.
 */
export async function resolveSession(db: DbClient, rawToken: string): Promise<string | null> {
	const tokenHash = hashToken(rawToken);
	const now = new Date().toISOString();

	const rows = await db
		.select({ userId: sessions.userId, expiresAt: sessions.expiresAt })
		.from(sessions)
		.where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.invalidatedAt)))
		.limit(1);
	const row = rows[0];
	if (!row) {
		return null;
	}
	// Check expiry in application code (avoids DB-side timezone confusion).
	if (row.expiresAt && row.expiresAt < now) {
		return null;
	}
	return row.userId;
}

/**
 * Invalidate (logout) the session identified by the raw token.
 *
 * A no-op if the token does not correspond to an active session.
 */
export async function invalidateSession(db: DbClient, rawToken: string): Promise<void> {
	const tokenHash = hashToken(rawToken);
	await db
		.update(sessions)
		.set({ invalidatedAt: new Date().toISOString() })
		.where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.invalidatedAt)));
}

/** Parameters for {@link loginWithGitHub}. */
export interface LoginWithGitHubParams {
	githubUserId: string;
	githubLogin: string;
	githubName: string | null;
	/**
	 * Primary, verified email from the GitHub `/user/emails` endpoint.
	 * Null when GitHub returns no primary+verified address.
	 * Only this verified address is used for email-match linking — the
	 * unverified `/user.email` profile field is never passed here.
	 */
	verifiedEmail: string | null;
	workspaceId: string;
}

/** Result of a successful {@link loginWithGitHub} call. */
export interface LoginWithGitHubResult {
	userId: string;
	sessionToken: string;
	/** True when a new GitHub identity was linked (new user or newly linked existing user). */
	linked: boolean;
}

/**
 * Authenticate or provision a user via GitHub OAuth and open a new session.
 *
 * Resolution order:
 *  1. Existing `external_identities` row for `(providerId='github', subject=githubUserId)`.
 *  2. Existing user whose `primaryEmail` matches the verified GitHub email; link the identity.
 *  3. Create a new user, link the identity, and add workspace membership.
 *
 * Returns `{ error: "identity_conflict" }` when the email-matched user already has a
 * different GitHub identity linked. The caller must set the session cookie from `sessionToken`.
 */
export async function loginWithGitHub(
	db: DbClient,
	args: LoginWithGitHubParams,
): Promise<LoginWithGitHubResult | { error: "identity_conflict" }> {
	const now = new Date().toISOString();
	const githubSubject = String(args.githubUserId);

	// 1. Existing GitHub identity → returning user.
	const existingIdentityRows = await db
		.select({ userId: externalIdentities.userId })
		.from(externalIdentities)
		.where(
			and(
				eq(externalIdentities.providerId, "github"),
				eq(externalIdentities.subject, githubSubject),
			),
		)
		.limit(1);

	if (existingIdentityRows[0]) {
		const userId = existingIdentityRows[0].userId;
		const sessionToken = randomBytes(32).toString("hex");
		const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
		await db.insert(sessions).values({
			id: `sess_${randomUUID()}`,
			userId,
			tokenHash: hashToken(sessionToken),
			createdAt: now,
			expiresAt,
		});
		return { userId, sessionToken, linked: false };
	}

	// 2. No existing GitHub identity — try to match by verified email.
	let resolvedUserId: string | null = null;
	let linked = false;

	if (args.verifiedEmail) {
		const email = args.verifiedEmail.toLowerCase().trim();
		const existingUserRows = await db
			.select({ id: users.id })
			.from(users)
			.where(eq(users.primaryEmail, email))
			.limit(1);

		if (existingUserRows[0]) {
			const candidateUserId = existingUserRows[0].id;

			// Guard: check for a conflicting GitHub identity already on this user.
			const conflictRows = await db
				.select({ subject: externalIdentities.subject })
				.from(externalIdentities)
				.where(
					and(
						eq(externalIdentities.providerId, "github"),
						eq(externalIdentities.userId, candidateUserId),
					),
				)
				.limit(1);

			if (conflictRows[0]) {
				return { error: "identity_conflict" };
			}

			// Link the GitHub identity to the existing user.
			await db.insert(externalIdentities).values({
				id: `ext_${randomUUID()}`,
				userId: candidateUserId,
				providerId: "github",
				subject: githubSubject,
				email,
				emailVerified: true,
				linkedAt: now,
				credentialHash: null,
			});
			resolvedUserId = candidateUserId;
			linked = true;
		}
	}

	// 3. No existing user found — create a new one.
	if (!resolvedUserId) {
		const newUserId = `user_${randomUUID()}`;
		const displayName = args.githubName ?? args.githubLogin;
		const emailNorm = args.verifiedEmail?.toLowerCase().trim() ?? null;
		const primaryEmail = emailNorm ?? `github:${githubSubject}@tundra.local`;

		await db.insert(users).values({
			id: newUserId,
			primaryEmail,
			emailVerified: emailNorm !== null,
			displayName,
			status: "active",
			createdAt: now,
			updatedAt: now,
		});

		await db.insert(externalIdentities).values({
			id: `ext_${randomUUID()}`,
			userId: newUserId,
			providerId: "github",
			subject: githubSubject,
			email: emailNorm,
			emailVerified: emailNorm !== null,
			linkedAt: now,
			credentialHash: null,
		});

		await db.insert(workspaceMemberships).values({
			id: `wsm_${randomUUID()}`,
			workspaceId: args.workspaceId,
			userId: newUserId,
			role: "member",
			joinedAt: now,
		});

		resolvedUserId = newUserId;
		linked = true;
	}

	const sessionToken = randomBytes(32).toString("hex");
	const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
	await db.insert(sessions).values({
		id: `sess_${randomUUID()}`,
		userId: resolvedUserId,
		tokenHash: hashToken(sessionToken),
		createdAt: now,
		expiresAt,
	});

	return { userId: resolvedUserId, sessionToken, linked };
}

/** Open a fresh session for a user and return the raw token (caller sets the cookie). */
async function openSession(db: DbClient, userId: string): Promise<string> {
	const sessionToken = randomBytes(32).toString("hex");
	const now = new Date().toISOString();
	const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
	await db.insert(sessions).values({
		id: `sess_${randomUUID()}`,
		userId,
		tokenHash: hashToken(sessionToken),
		createdAt: now,
		expiresAt,
	});
	return sessionToken;
}

/** Workspace roles an identity provider may assign through {@link loginWithOidc}. */
export type IdpWorkspaceRole = "admin" | "member";

/**
 * Align a user's workspace role with what the identity provider asserts.
 *
 * The IdP (e.g. Keycloak groups) is the source of truth for `admin`/`member`
 * in OIDC deployments, with two safety exceptions: an `owner` role is never
 * touched, and a demotion that would leave the workspace without any admin
 * of the same role is skipped rather than applied.
 */
async function syncWorkspaceRoleFromIdp(
	db: DbClient,
	args: { workspaceId: string; userId: string; role: IdpWorkspaceRole },
): Promise<void> {
	const membershipRows = await db
		.select()
		.from(workspaceMemberships)
		.where(
			and(
				eq(workspaceMemberships.workspaceId, args.workspaceId),
				eq(workspaceMemberships.userId, args.userId),
			),
		)
		.limit(1);
	const membership = membershipRows[0];

	if (!membership) {
		await db.insert(workspaceMemberships).values({
			id: `wsm_${randomUUID()}`,
			workspaceId: args.workspaceId,
			userId: args.userId,
			role: args.role,
			joinedAt: new Date().toISOString(),
		});
		return;
	}

	const current = membership.role;
	if (current === args.role || current === "owner") {
		return;
	}

	if (current === "admin" && args.role !== "admin") {
		const adminRows = await db
			.select({ id: workspaceMemberships.id })
			.from(workspaceMemberships)
			.where(
				and(
					eq(workspaceMemberships.workspaceId, args.workspaceId),
					eq(workspaceMemberships.role, "admin"),
				),
			);
		if (adminRows.length <= 1) {
			// Never demote the last admin, even on the IdP's say-so.
			return;
		}
	}

	await db
		.update(workspaceMemberships)
		.set({ role: args.role })
		.where(eq(workspaceMemberships.id, membership.id));
}

/** Parameters for {@link loginWithOidc}. */
export interface LoginWithOidcParams {
	/** Identity provider id, e.g. `oidc:keycloak`. Stored on the external identity. */
	providerId: string;
	/** Stable OIDC `sub` claim for this user at the issuer. */
	subject: string;
	/**
	 * Email claim, but only when the token asserted `email_verified: true`;
	 * null otherwise. Only a verified address may email-match an existing user.
	 */
	verifiedEmail: string | null;
	/** Display-name claim (`name`/`preferred_username`); null when absent. */
	name: string | null;
	/** Workspace role mapped from the IdP's roles/groups claims. */
	workspaceRole: IdpWorkspaceRole;
	workspaceId: string;
}

/** Result of a successful {@link loginWithOidc} call. */
export interface LoginWithOidcResult {
	userId: string;
	sessionToken: string;
	/** True when a new OIDC identity was linked (new user or newly linked existing user). */
	linked: boolean;
}

/**
 * Authenticate or provision a user via an OIDC identity provider and open a
 * new session.
 *
 * Resolution order mirrors {@link loginWithGitHub}:
 *  1. Existing `external_identities` row for `(providerId, subject)`.
 *  2. Existing user whose `primaryEmail` matches the verified email; link.
 *  3. Create a new user, link the identity, and add workspace membership.
 *
 * On every login the workspace role is re-synced from the IdP claims via
 * {@link syncWorkspaceRoleFromIdp} (owner kept, last admin never demoted).
 * Returns `{ error: "identity_conflict" }` when the email-matched user already
 * has a different identity for the same provider.
 */
export async function loginWithOidc(
	db: DbClient,
	args: LoginWithOidcParams,
): Promise<LoginWithOidcResult | { error: "identity_conflict" }> {
	const now = new Date().toISOString();

	// 1. Existing OIDC identity → returning user.
	const existingIdentityRows = await db
		.select({ userId: externalIdentities.userId })
		.from(externalIdentities)
		.where(
			and(
				eq(externalIdentities.providerId, args.providerId),
				eq(externalIdentities.subject, args.subject),
			),
		)
		.limit(1);

	if (existingIdentityRows[0]) {
		const userId = existingIdentityRows[0].userId;
		await syncWorkspaceRoleFromIdp(db, {
			workspaceId: args.workspaceId,
			userId,
			role: args.workspaceRole,
		});
		const sessionToken = await openSession(db, userId);
		return { userId, sessionToken, linked: false };
	}

	// 2. No existing identity — try to match by verified email.
	let resolvedUserId: string | null = null;

	if (args.verifiedEmail) {
		const email = args.verifiedEmail.toLowerCase().trim();
		const existingUserRows = await db
			.select({ id: users.id })
			.from(users)
			.where(eq(users.primaryEmail, email))
			.limit(1);

		if (existingUserRows[0]) {
			const candidateUserId = existingUserRows[0].id;

			// Guard: the user must not already have a different subject at this provider.
			const conflictRows = await db
				.select({ subject: externalIdentities.subject })
				.from(externalIdentities)
				.where(
					and(
						eq(externalIdentities.providerId, args.providerId),
						eq(externalIdentities.userId, candidateUserId),
					),
				)
				.limit(1);

			if (conflictRows[0]) {
				return { error: "identity_conflict" };
			}

			await db.insert(externalIdentities).values({
				id: `ext_${randomUUID()}`,
				userId: candidateUserId,
				providerId: args.providerId,
				subject: args.subject,
				email,
				emailVerified: true,
				linkedAt: now,
				credentialHash: null,
			});
			resolvedUserId = candidateUserId;
		}
	}

	// 3. No existing user found — create a new one.
	if (!resolvedUserId) {
		const newUserId = `user_${randomUUID()}`;
		const emailNorm = args.verifiedEmail?.toLowerCase().trim() ?? null;
		const primaryEmail = emailNorm ?? `${args.providerId}:${args.subject}@tundra.local`;

		await db.insert(users).values({
			id: newUserId,
			primaryEmail,
			emailVerified: emailNorm !== null,
			displayName: args.name ?? args.subject,
			status: "active",
			createdAt: now,
			updatedAt: now,
		});

		await db.insert(externalIdentities).values({
			id: `ext_${randomUUID()}`,
			userId: newUserId,
			providerId: args.providerId,
			subject: args.subject,
			email: emailNorm,
			emailVerified: emailNorm !== null,
			linkedAt: now,
			credentialHash: null,
		});

		resolvedUserId = newUserId;
	}

	await syncWorkspaceRoleFromIdp(db, {
		workspaceId: args.workspaceId,
		userId: resolvedUserId,
		role: args.workspaceRole,
	});
	const sessionToken = await openSession(db, resolvedUserId);
	return { userId: resolvedUserId, sessionToken, linked: true };
}
