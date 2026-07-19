/**
 * Postgres-backed {@link DataSource}, wrapping the `@tundra/db` repositories.
 *
 * This adapter is intentionally thin: every method delegates to a repo function,
 * which in turn defers aggregation (`selectMyTasks`) and revert authorization
 * (`canRevertAction`) to `@tundra/domain`. The only logic that lives here is the
 * viewer projection, which needs the user's display name alongside the principal.
 */

import {
	changeWorkItemStatus as dbChangeWorkItemStatus,
	changeWorkspaceMemberRole as dbChangeWorkspaceMemberRole,
	createWorkItem as dbCreateWorkItem,
	getAuditHistory,
	getUser,
	invalidateSession as dbInvalidateSession,
	listProjects as dbListProjects,
	loginWithGitHub as dbLoginWithGitHub,
	loginWithOidc as dbLoginWithOidc,
	listWorkspaceMembers as dbListWorkspaceMembers,
	loadSessionPrincipal,
	loginUser as dbLoginUser,
	registerUser as dbRegisterUser,
	resolveSession as dbResolveSession,
	revertAuditEvent as dbRevertAuditEvent,
	selectMyTasksForUser,
	updateWorkItem as dbUpdateWorkItem,
} from "@tundra/db";
import type { DbHandle, WorkspaceMemberRow } from "@tundra/db";
import { isWorkspaceAdmin } from "@tundra/domain";
import type {
	AuditEvent,
	Project,
	RevertDecision,
	SessionPrincipal,
	UserId,
	WorkItem,
	WorkItemPriority,
	WorkItemStatus,
	WorkspaceRole,
} from "@tundra/domain";

import type {
	ChangeWorkItemStatusError,
	ChangeWorkItemStatusOk,
	DataSource,
	LoginWithGitHubResult,
	LoginWithOidcResult,
	ViewerDto,
} from "./types.js";

/** Provider id stored on external identities created by the OIDC login flow. */
const OIDC_PROVIDER_ID = "oidc:keycloak";

/** The default workspace id for the single-workspace MVP. */
const DEFAULT_WORKSPACE_ID = "ws-tundra";

/** Build a Postgres-backed data source from an open db handle. */
export function createDbDataSource(handle: DbHandle): DataSource {
	const { db } = handle;

	return {
		async viewer(principal: SessionPrincipal): Promise<ViewerDto> {
			const userId = principal.userId ?? "anonymous";
			let displayName = userId;
			if (principal.userId) {
				const user = await getUser(db, principal.userId);
				if (user) {
					displayName = user.displayName;
				}
			}
			return {
				userId,
				displayName,
				workspaceId: principal.workspaceId ?? null,
				workspaceRole: principal.workspaceRole ?? null,
				permissions: [...principal.permissions],
				isWorkspaceAdmin: isWorkspaceAdmin(principal),
			};
		},

		listProjects(): Promise<Project[]> {
			return dbListProjects(db);
		},

		myTasks(assigneeId: UserId): Promise<WorkItem[]> {
			return selectMyTasksForUser(db, assigneeId);
		},

		auditHistory(targetType: string, targetId: string): Promise<AuditEvent[]> {
			return getAuditHistory(db, targetType, targetId);
		},

		async changeWorkItemStatus(
			principal: SessionPrincipal,
			workItemId: string,
			status: WorkItemStatus,
		): Promise<ChangeWorkItemStatusOk | ChangeWorkItemStatusError> {
			const result = await dbChangeWorkItemStatus(db, { workItemId, status, principal });
			if ("error" in result) {
				return { error: result.error };
			}
			return { workItem: result.workItem, event: result.event };
		},

		revertAuditEvent(
			principal: SessionPrincipal,
			eventId: string,
		): Promise<RevertDecision & { event?: AuditEvent }> {
			return dbRevertAuditEvent(db, { eventId, principal });
		},

		loadPrincipal(userId: string): Promise<SessionPrincipal | null> {
			return loadSessionPrincipal(db, userId);
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
			return dbCreateWorkItem(db, { input, principal });
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
			const result = await dbUpdateWorkItem(db, { workItemId, input, principal });
			if ("error" in result) {
				return { error: result.error };
			}
			return result;
		},

		listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMemberRow[]> {
			return dbListWorkspaceMembers(db, workspaceId);
		},

		async changeWorkspaceMemberRole(
			principal: SessionPrincipal,
			workspaceId: string,
			targetUserId: string,
			newRole: WorkspaceRole,
		): Promise<{ eventId: string } | { error: string }> {
			const result = await dbChangeWorkspaceMemberRole(db, {
				workspaceId,
				targetUserId,
				newRole,
				principal,
			});
			if ("error" in result) {
				return { error: result.error };
			}
			return result;
		},

		async register(
			email: string,
			password: string,
			displayName: string,
		): Promise<{ userId: string; sessionToken: string } | { error: string }> {
			return dbRegisterUser(db, {
				email,
				password,
				displayName,
				workspaceId: DEFAULT_WORKSPACE_ID,
			});
		},

		async login(
			email: string,
			password: string,
		): Promise<{ userId: string; sessionToken: string } | { error: string }> {
			return dbLoginUser(db, { email, password });
		},

		resolveSession(token: string): Promise<string | null> {
			return dbResolveSession(db, token);
		},

		invalidateSession(token: string): Promise<void> {
			return dbInvalidateSession(db, token);
		},

		async loginWithGitHub(args: {
			githubUserId: string;
			githubLogin: string;
			githubName: string | null;
			verifiedEmail: string | null;
		}): Promise<LoginWithGitHubResult | { error: string }> {
			return dbLoginWithGitHub(db, { ...args, workspaceId: DEFAULT_WORKSPACE_ID });
		},

		async loginWithOidc(args: {
			subject: string;
			verifiedEmail: string | null;
			name: string | null;
			workspaceRole: "admin" | "member";
		}): Promise<LoginWithOidcResult | { error: string }> {
			return dbLoginWithOidc(db, {
				...args,
				providerId: OIDC_PROVIDER_ID,
				workspaceId: DEFAULT_WORKSPACE_ID,
			});
		},
	};
}
