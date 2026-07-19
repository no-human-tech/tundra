/**
 * Pure row ↔ domain mappers.
 *
 * Each function converts a Drizzle row (the persistence shape) into the
 * corresponding `@tundra/domain` type, or the inverse for inserts. They contain
 * no I/O and are unit-tested directly; the repositories below compose them with
 * the actual queries.
 *
 * Domain types use optional fields (absent when unset); Postgres columns use
 * `null`. The mappers translate between the two so callers never see `null`.
 */

import type {
	ActionSource,
	AuditEvent,
	AuditEventId,
	ExternalIdentity,
	ExternalIdentityId,
	ISODateString,
	ModuleId,
	Project,
	ProjectId,
	Reversibility,
	SprintId,
	UserId,
	User,
	UserStatus,
	WorkItem,
	WorkItemId,
	WorkItemPriority,
	WorkItemSource,
	WorkItemSourceRef,
	WorkItemStatus,
	WorkspaceId,
	WorkspaceMembership,
	WorkspaceMembershipId,
	WorkspaceRole,
} from "@tundra/domain";

import type {
	auditEvents,
	externalIdentities,
	projects,
	users,
	workItems,
	workspaceMemberships,
} from "./schema/tables.js";

type ProjectRow = typeof projects.$inferSelect;
type WorkItemRow = typeof workItems.$inferSelect;
type UserRow = typeof users.$inferSelect;
type ExternalIdentityRow = typeof externalIdentities.$inferSelect;
type WorkspaceMembershipRow = typeof workspaceMemberships.$inferSelect;
type AuditEventRow = typeof auditEvents.$inferSelect;

/** Drop a nullable column to `undefined` so it matches an optional domain field. */
function opt<T>(value: T | null): T | undefined {
	return value === null ? undefined : value;
}

// --- Project ------------------------------------------------------------------

/** Map a `projects` row into a domain {@link Project}. */
export function rowToProject(row: ProjectRow): Project {
	return {
		id: row.id as ProjectId,
		workspaceId: row.workspaceId as WorkspaceId,
		name: row.name,
		key: row.key,
		slug: row.slug,
		description: opt(row.description),
		enabledModuleIds: row.enabledModuleIds as ModuleId[],
		archivedAt: opt(row.archivedAt) as ISODateString | undefined,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

// --- WorkItem -----------------------------------------------------------------

/** Map a `work_items` row into a domain {@link WorkItem}. */
export function rowToWorkItem(row: WorkItemRow): WorkItem {
	return {
		id: row.id as WorkItemId,
		projectId: row.projectId as ProjectId,
		source: row.source as WorkItemSource,
		sourceRef: row.sourceRef as unknown as WorkItemSourceRef,
		title: row.title,
		status: row.status as WorkItemStatus,
		priority: row.priority as WorkItemPriority,
		assigneeId: opt(row.assigneeId) as UserId | undefined,
		dueDate: opt(row.dueDate) as ISODateString | undefined,
		sprintId: opt(row.sprintId) as SprintId | undefined,
		metadata: opt(row.metadata),
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

/** Build a `work_items` insert row from a domain {@link WorkItem}. */
export function workItemToInsert(item: WorkItem): WorkItemRow {
	return {
		id: item.id,
		projectId: item.projectId,
		source: item.source,
		sourceRef: item.sourceRef as unknown as Record<string, unknown>,
		title: item.title,
		status: item.status,
		priority: item.priority,
		assigneeId: item.assigneeId ?? null,
		dueDate: item.dueDate ?? null,
		sprintId: item.sprintId ?? null,
		metadata: item.metadata ?? null,
		createdAt: item.createdAt,
		updatedAt: item.updatedAt,
	};
}

// --- User ---------------------------------------------------------------------

/** Map a `users` row into a domain {@link User}. */
export function rowToUser(row: UserRow): User {
	return {
		id: row.id as UserId,
		primaryEmail: row.primaryEmail,
		emailVerified: row.emailVerified,
		displayName: row.displayName,
		status: row.status as UserStatus,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

// --- ExternalIdentity ---------------------------------------------------------

/** Map an `external_identities` row into a domain {@link ExternalIdentity}. */
export function rowToExternalIdentity(row: ExternalIdentityRow): ExternalIdentity {
	return {
		id: row.id as ExternalIdentityId,
		userId: row.userId as UserId,
		providerId: row.providerId,
		subject: row.subject,
		email: opt(row.email),
		emailVerified: row.emailVerified,
		linkedAt: row.linkedAt,
		// `external_identities` has no createdAt/updatedAt columns of its own; the
		// domain Entity base derives them from linkedAt for this slice.
		createdAt: row.linkedAt,
		updatedAt: row.linkedAt,
	};
}

// --- WorkspaceMembership ------------------------------------------------------

/** Map a `workspace_memberships` row into a domain {@link WorkspaceMembership}. */
export function rowToWorkspaceMembership(row: WorkspaceMembershipRow): WorkspaceMembership {
	return {
		id: row.id as WorkspaceMembershipId,
		workspaceId: row.workspaceId as WorkspaceId,
		userId: row.userId as UserId,
		role: row.role as WorkspaceRole,
		joinedAt: row.joinedAt,
		createdAt: row.joinedAt,
		updatedAt: row.joinedAt,
	};
}

// --- AuditEvent ---------------------------------------------------------------

/** Map an `audit_events` row into a domain {@link AuditEvent}. */
export function rowToAuditEvent(row: AuditEventRow): AuditEvent {
	return {
		id: row.id as AuditEventId,
		actorUserId: opt(row.actorUserId) as UserId | undefined,
		source: row.source as ActionSource,
		workspaceId: opt(row.workspaceId) as WorkspaceId | undefined,
		projectId: opt(row.projectId) as ProjectId | undefined,
		action: row.action,
		targetType: row.targetType,
		targetId: row.targetId,
		occurredAt: row.occurredAt,
		before: opt(row.before),
		after: opt(row.after),
		inverse: opt(row.inverse),
		reversibility: row.reversibility as Reversibility,
		irreversibleReason: opt(row.irreversibleReason),
		correlationId: opt(row.correlationId),
		reversalOfEventId: opt(row.reversalOfEventId) as AuditEventId | undefined,
		// Append-only: there is no updatedAt column; mirror createdAt for the
		// Entity base.
		createdAt: row.createdAt,
		updatedAt: row.createdAt,
	};
}

/**
 * Build an `audit_events` insert row from a domain {@link AuditEvent}. Drops the
 * Entity `updatedAt` (the table is append-only and has no such column) and
 * coerces the opaque before/after/inverse payloads to the jsonb column type.
 */
export function auditEventToInsert(event: AuditEvent): AuditEventRow {
	return {
		id: event.id,
		actorUserId: event.actorUserId ?? null,
		source: event.source,
		workspaceId: event.workspaceId ?? null,
		projectId: event.projectId ?? null,
		action: event.action,
		targetType: event.targetType,
		targetId: event.targetId,
		occurredAt: event.occurredAt,
		before: (event.before ?? null) as Record<string, unknown> | null,
		after: (event.after ?? null) as Record<string, unknown> | null,
		inverse: (event.inverse ?? null) as Record<string, unknown> | null,
		reversibility: event.reversibility,
		irreversibleReason: event.irreversibleReason ?? null,
		correlationId: event.correlationId ?? null,
		reversalOfEventId: event.reversalOfEventId ?? null,
		createdAt: event.createdAt,
	};
}
