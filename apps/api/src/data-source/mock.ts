/**
 * In-memory {@link DataSource} over the `./mock-data` fixtures plus a private,
 * append-only audit log.
 *
 * This implementation backs the default `pnpm test` run and the API's `mock`
 * data-source mode — no Postgres required. Crucially it implements the same
 * reversible-action PoC as the db adapter:
 *
 *  - `changeWorkItemStatus` mutates the in-memory work item and APPENDS a domain
 *    `AuditEvent` (ids/timestamps generated locally).
 *  - `revertAuditEvent` derives `alreadyReverted` / `dependentEvents` from the
 *    in-memory log, asks the domain `canRevertAction`, applies the inverse to the
 *    in-memory item, and APPENDS a compensating `makeReversalEvent`. The original
 *    event is never mutated — the log only grows.
 *
 * Auth methods (`register`, `login`, `resolveSession`, `invalidateSession`) are
 * stubbed for the mock backend — they return success but do not persist sessions
 * or validate passwords. Tests that need real auth should use the db backend.
 *
 * Each instance owns its own copies of the fixtures, so tests are isolated.
 */

import { randomUUID } from "node:crypto";

import {
	Reversibility,
	RevertDenyReason,
	canRevertAction,
	isReverted,
	isWorkspaceAdmin,
	makeReversalEvent,
	selectMyTasks,
} from "@tundra/domain";
import type {
	AuditEvent,
	AuditEventId,
	Project,
	ProjectId,
	RevertDecision,
	SessionPrincipal,
	UserId,
	WorkItem,
	WorkItemId,
	WorkItemPriority,
	WorkItemStatus,
	WorkspaceId,
	WorkspaceRole,
} from "@tundra/domain";
import type { WorkspaceMemberRow } from "@tundra/db";

import { mockProjects, mockUserDisplayNames, mockWorkItems } from "../mock-data.js";
import { buildMockPrincipal } from "../session.js";
import type {
	ChangeWorkItemStatusError,
	ChangeWorkItemStatusOk,
	DataSource,
	LoginWithGitHubResult,
	LoginWithOidcResult,
	ViewerDto,
} from "./types.js";

/** Deep-ish clone of a work item so the source fixture stays pristine. */
function cloneWorkItem(item: WorkItem): WorkItem {
	return { ...item, sourceRef: { ...item.sourceRef } };
}

/** Mock workspace members for the admin panel. */
const MOCK_MEMBERS: WorkspaceMemberRow[] = [
	{
		userId: "user-ada",
		displayName: "Ada Lovelace",
		primaryEmail: "ada@example.com",
		role: "admin" as WorkspaceRole,
		joinedAt: "2024-01-01T00:00:00.000Z",
	},
	{
		userId: "user-bob",
		displayName: "Bob Martin",
		primaryEmail: "bob@example.com",
		role: "member" as WorkspaceRole,
		joinedAt: "2024-01-02T00:00:00.000Z",
	},
];

/** Create an in-memory data source seeded from the mock fixtures. */
export function createMockDataSource(): DataSource {
	// Private mutable state owned by this instance.
	const projects: Project[] = mockProjects.map((p) => ({ ...p }));
	const workItems: WorkItem[] = mockWorkItems.map(cloneWorkItem);
	const auditLog: AuditEvent[] = [];

	function findWorkItem(id: string): WorkItem | undefined {
		return workItems.find((w) => w.id === id);
	}

	return {
		async viewer(principal: SessionPrincipal): Promise<ViewerDto> {
			const userId = principal.userId ?? "anonymous";
			const displayName = principal.userId
				? (mockUserDisplayNames[principal.userId] ?? userId)
				: userId;
			return {
				userId,
				displayName,
				workspaceId: principal.workspaceId ?? null,
				workspaceRole: principal.workspaceRole ?? null,
				permissions: [...principal.permissions],
				isWorkspaceAdmin: isWorkspaceAdmin(principal),
			};
		},

		async listProjects(): Promise<Project[]> {
			return projects.map((p) => ({ ...p }));
		},

		async myTasks(assigneeId: UserId): Promise<WorkItem[]> {
			return selectMyTasks(workItems.map(cloneWorkItem), { assigneeId });
		},

		async auditHistory(targetType: string, targetId: string): Promise<AuditEvent[]> {
			return auditLog
				.filter((e) => e.targetType === targetType && e.targetId === targetId)
				.sort((a, b) =>
					a.occurredAt === b.occurredAt
						? a.id.localeCompare(b.id)
						: a.occurredAt.localeCompare(b.occurredAt),
				)
				.map((e) => ({ ...e }));
		},

		async changeWorkItemStatus(
			principal: SessionPrincipal,
			workItemId: string,
			status: WorkItemStatus,
		): Promise<ChangeWorkItemStatusOk | ChangeWorkItemStatusError> {
			const item = findWorkItem(workItemId);
			if (!item) {
				return { error: "not_found" };
			}

			const oldStatus = item.status;
			const now = new Date().toISOString();

			// Mutate the in-memory item.
			item.status = status;
			item.updatedAt = now;

			// Append the reversible audit event built from domain shapes.
			const event: AuditEvent = {
				id: `evt_${randomUUID()}` as AuditEventId,
				createdAt: now,
				updatedAt: now,
				occurredAt: now,
				actorUserId: principal.userId,
				source: principal.source,
				projectId: item.projectId,
				action: "workitem.status_changed",
				targetType: "WorkItem",
				targetId: item.id,
				before: { status: oldStatus },
				after: { status },
				inverse: { status: oldStatus },
				reversibility: Reversibility.Reversible,
			};
			auditLog.push(event);

			return { workItem: cloneWorkItem(item), event: { ...event } };
		},

		async revertAuditEvent(
			principal: SessionPrincipal,
			eventId: string,
		): Promise<RevertDecision & { event?: AuditEvent }> {
			const original = auditLog.find((e) => e.id === eventId);
			if (!original) {
				return {
					allowed: false,
					reason: RevertDenyReason.NotFound,
					message: "Cannot revert: the audit event was not found",
				};
			}

			// Derived facts, read from the in-memory log (never mutating the original).
			const alreadyReverted = isReverted(auditLog, original.id);
			const dependentEvents = auditLog.filter(
				(e) =>
					e.targetType === original.targetType &&
					e.targetId === original.targetId &&
					e.id !== original.id &&
					e.reversalOfEventId === undefined &&
					e.occurredAt > original.occurredAt,
			);

			const decision = canRevertAction({
				principal,
				event: original,
				alreadyReverted,
				dependentEvents,
			});
			if (!decision.allowed) {
				return decision;
			}

			// Apply the inverse. The only reversible action in this slice is a
			// work-item status change, whose inverse is { status }.
			if (original.action === "workitem.status_changed") {
				const inverse = decision.plan.inverse as { status?: WorkItemStatus } | undefined;
				const item = findWorkItem(original.targetId);
				if (item && inverse?.status !== undefined) {
					item.status = inverse.status;
					item.updatedAt = new Date().toISOString();
				}
			}

			const compensating = makeReversalEvent({
				plan: decision.plan,
				principal,
				original,
				id: `evt_${randomUUID()}` as AuditEventId,
				occurredAt: new Date().toISOString(),
			});
			auditLog.push(compensating);

			return { allowed: true, plan: decision.plan, event: { ...compensating } };
		},

		async loadPrincipal(userId: string): Promise<SessionPrincipal | null> {
			// Mock mode knows the fixture users; everyone else falls back to Member.
			return buildMockPrincipal(userId);
		},

		async createWorkItem(
			principal: SessionPrincipal,
			input: {
				projectId: string;
				title: string;
				source: WorkItem["source"];
				priority: WorkItemPriority;
				assigneeId?: string;
				dueDate?: string;
			},
		): Promise<{ workItem: WorkItem; eventId: string } | { error: string }> {
			const now = new Date().toISOString();
			const id = `wi_${randomUUID()}`;
			const newItem: WorkItem = {
				id: id as WorkItemId,
				projectId: input.projectId as ProjectId,
				source: input.source,
				sourceRef: { source: input.source, refId: id },
				title: input.title,
				status: "todo" as WorkItemStatus,
				priority: input.priority,
				assigneeId: input.assigneeId as UserId | undefined,
				createdAt: now,
				updatedAt: now,
			};
			workItems.push(newItem);

			const event: AuditEvent = {
				id: `evt_${randomUUID()}` as AuditEventId,
				createdAt: now,
				updatedAt: now,
				occurredAt: now,
				actorUserId: principal.userId,
				source: principal.source,
				projectId: input.projectId as ProjectId,
				action: "workitem.created",
				targetType: "WorkItem",
				targetId: id,
				after: { title: input.title, status: "todo", priority: input.priority },
				reversibility: Reversibility.Irreversible,
				irreversibleReason: "Creation events cannot be reversed via the revert mechanism",
			};
			auditLog.push(event);
			return { workItem: cloneWorkItem(newItem), eventId: event.id };
		},

		async updateWorkItem(
			principal: SessionPrincipal,
			workItemId: string,
			input: {
				title?: string;
				priority?: WorkItemPriority;
				assigneeId?: string | null;
				dueDate?: string | null;
			},
		): Promise<{ workItem: WorkItem; eventId: string } | { error: string }> {
			const item = findWorkItem(workItemId);
			if (!item) {
				return { error: "not_found" };
			}

			const now = new Date().toISOString();
			const before: Record<string, unknown> = {};
			const after: Record<string, unknown> = {};

			if (input.title !== undefined) {
				before["title"] = item.title;
				after["title"] = input.title;
				item.title = input.title;
			}
			if (input.priority !== undefined) {
				before["priority"] = item.priority;
				after["priority"] = input.priority;
				item.priority = input.priority;
			}
			if ("assigneeId" in input) {
				before["assigneeId"] = item.assigneeId ?? null;
				after["assigneeId"] = input.assigneeId ?? null;
				item.assigneeId = (input.assigneeId as UserId | null) ?? undefined;
			}
			item.updatedAt = now;

			const event: AuditEvent = {
				id: `evt_${randomUUID()}` as AuditEventId,
				createdAt: now,
				updatedAt: now,
				occurredAt: now,
				actorUserId: principal.userId,
				source: principal.source,
				projectId: item.projectId,
				action: "workitem.updated",
				targetType: "WorkItem",
				targetId: item.id,
				before,
				after,
				reversibility: Reversibility.Irreversible,
				irreversibleReason: "General field updates are not reversible via the revert mechanism",
			};
			auditLog.push(event);
			return { workItem: cloneWorkItem(item), eventId: event.id };
		},

		async listWorkspaceMembers(_workspaceId: string): Promise<WorkspaceMemberRow[]> {
			return MOCK_MEMBERS.map((m) => ({ ...m }));
		},

		async changeWorkspaceMemberRole(
			principal: SessionPrincipal,
			workspaceId: string,
			targetUserId: string,
			newRole: WorkspaceRole,
		): Promise<{ eventId: string } | { error: string }> {
			const member = MOCK_MEMBERS.find((m) => m.userId === targetUserId);
			if (!member) {
				return { error: "not_found" };
			}

			// Prevent demoting the last admin.
			const oldRole = member.role;
			if (
				(oldRole === "admin" || oldRole === "owner") &&
				newRole !== "admin" &&
				newRole !== "owner"
			) {
				const adminCount = MOCK_MEMBERS.filter(
					(m) => m.role === "admin" || m.role === "owner",
				).length;
				if (adminCount <= 1) {
					return { error: "last_admin" };
				}
			}

			const now = new Date().toISOString();
			const event: AuditEvent = {
				id: `evt_${randomUUID()}` as AuditEventId,
				createdAt: now,
				updatedAt: now,
				occurredAt: now,
				actorUserId: principal.userId,
				source: principal.source,
				workspaceId: workspaceId as WorkspaceId,
				action: "member.role_changed",
				targetType: "WorkspaceMembership",
				targetId: targetUserId,
				before: { role: oldRole },
				after: { role: newRole },
				reversibility: Reversibility.Reversible,
				inverse: { role: oldRole },
			};
			auditLog.push(event);
			member.role = newRole;
			return { eventId: event.id };
		},

		async register(
			_email: string,
			_password: string,
			_displayName: string,
		): Promise<{ userId: string; sessionToken: string } | { error: string }> {
			// Stub: mock mode does not persist users or validate passwords.
			return { userId: `user_${randomUUID()}`, sessionToken: randomUUID() };
		},

		async login(
			email: string,
			_password: string,
		): Promise<{ userId: string; sessionToken: string } | { error: string }> {
			// Stub: accept any password; resolve to the first fixture user whose email matches.
			const fixture = MOCK_MEMBERS.find((m) => m.primaryEmail === email);
			if (!fixture) {
				return { error: "invalid_credentials" };
			}
			return { userId: fixture.userId, sessionToken: randomUUID() };
		},

		async resolveSession(_token: string): Promise<string | null> {
			// Mock sessions are not persisted; always return null so the fallback to
			// the dev header is used in mock mode.
			return null;
		},

		async invalidateSession(_token: string): Promise<void> {
			// No-op in mock mode.
		},

		async loginWithGitHub(args: {
			githubUserId: string;
			githubLogin: string;
			githubName: string | null;
			verifiedEmail: string | null;
		}): Promise<LoginWithGitHubResult | { error: string }> {
			// Stub: mock mode creates a transient session for any GitHub identity.
			return { userId: `github_${args.githubUserId}`, sessionToken: randomUUID(), linked: false };
		},

		async loginWithOidc(args: {
			subject: string;
			verifiedEmail: string | null;
			name: string | null;
			workspaceRole: "admin" | "member";
		}): Promise<LoginWithOidcResult | { error: string }> {
			// Stub: mock mode creates a transient session for any OIDC identity.
			return { userId: `oidc_${args.subject}`, sessionToken: randomUUID(), linked: false };
		},
	};
}
