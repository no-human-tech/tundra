/**
 * The data-source port: the single boundary resolvers read and write through.
 *
 * Resolvers never know whether they are talking to Postgres or to in-memory
 * mock data — they only see this interface. The two implementations live beside
 * it (`./db.ts`, `./mock.ts`); `apps/api/src/index.ts` picks one at startup based
 * on `config.dataSource`. Keeping this seam clean is what lets the default test
 * run execute the full GraphQL surface (including the reversible-action PoC)
 * without ever connecting to a database.
 */

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
import type { WorkspaceMemberRow } from "@tundra/db";

/**
 * The viewer projection returned to the GraphQL `viewer` query. Derived purely
 * from the request's {@link SessionPrincipal} plus the acting user's display
 * name; carries no I/O of its own.
 */
export interface ViewerDto {
	userId: string;
	displayName: string;
	workspaceId: string | null;
	workspaceRole: string | null;
	permissions: string[];
	isWorkspaceAdmin: boolean;
}

/** Successful outcome of {@link DataSource.changeWorkItemStatus}. */
export interface ChangeWorkItemStatusOk {
	workItem: WorkItem;
	event: AuditEvent;
}

/** Failure outcome of {@link DataSource.changeWorkItemStatus}. */
export interface ChangeWorkItemStatusError {
	error: string;
}

/** Result of a successful GitHub OAuth login via {@link DataSource.loginWithGitHub}. */
export interface LoginWithGitHubResult {
	userId: string;
	sessionToken: string;
	/** True when a new GitHub identity was linked (new or newly-linked existing user). */
	linked: boolean;
}

/** Result of a successful OIDC login via {@link DataSource.loginWithOidc}. */
export interface LoginWithOidcResult {
	userId: string;
	sessionToken: string;
	/** True when a new OIDC identity was linked (new or newly-linked existing user). */
	linked: boolean;
}

/**
 * The backend-agnostic data port. Every method is async so the mock and db
 * implementations share one signature; the mock simply resolves immediately.
 */
export interface DataSource {
	/**
	 * Project the request principal (plus the acting user's display name) into the
	 * viewer shape. Synchronous-by-nature, but kept on the port for symmetry; in
	 * db mode the display name may require a lookup.
	 */
	viewer(principal: SessionPrincipal): Promise<ViewerDto>;

	/** All projects, ordered stably. */
	listProjects(): Promise<Project[]>;

	/** The unified "My Tasks" set for an assignee (active statuses, all sources). */
	myTasks(assigneeId: UserId): Promise<WorkItem[]>;

	/** Append-only audit history for a target, oldest first. */
	auditHistory(targetType: string, targetId: string): Promise<AuditEvent[]>;

	/**
	 * Reversible-action PoC: change a work item's status and record an append-only
	 * audit event. Returns `{ error }` when the work item does not exist.
	 */
	changeWorkItemStatus(
		principal: SessionPrincipal,
		workItemId: string,
		status: WorkItemStatus,
	): Promise<ChangeWorkItemStatusOk | ChangeWorkItemStatusError>;

	/**
	 * Revert a previously-recorded audit event. Uses the domain `canRevertAction`
	 * for authorization and `makeReversalEvent` to produce a compensating event;
	 * the original event is never mutated. On success the returned `event` is the
	 * compensating event.
	 */
	revertAuditEvent(
		principal: SessionPrincipal,
		eventId: string,
	): Promise<RevertDecision & { event?: AuditEvent }>;

	/**
	 * Resolve a {@link SessionPrincipal} for a user id, or `null` when unknown.
	 * Used by the dev-session context factory in db mode; the mock builds fixture
	 * principals directly instead.
	 */
	loadPrincipal(userId: string): Promise<SessionPrincipal | null>;

	// --- WorkItem mutations ------------------------------------------------------

	/**
	 * Create a new work item in a project and record an audit event.
	 *
	 * Returns `{ error }` on validation failure (e.g. unknown project).
	 */
	createWorkItem(
		principal: SessionPrincipal,
		input: {
			projectId: string;
			title: string;
			source: WorkItem["source"];
			priority: WorkItemPriority;
			assigneeId?: string;
			dueDate?: string;
		},
	): Promise<{ workItem: WorkItem; eventId: string } | { error: string }>;

	/**
	 * Update mutable fields on a work item and record an audit event.
	 *
	 * Returns `{ error: "not_found" }` when the work item does not exist.
	 */
	updateWorkItem(
		principal: SessionPrincipal,
		workItemId: string,
		input: {
			title?: string;
			priority?: WorkItemPriority;
			assigneeId?: string | null;
			dueDate?: string | null;
		},
	): Promise<{ workItem: WorkItem; eventId: string } | { error: string }>;

	// --- Admin -------------------------------------------------------------------

	/**
	 * List all workspace members with role and profile info.
	 *
	 * Only workspace admins/owners may call this; the resolver enforces the
	 * permission check before calling the data source.
	 */
	listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMemberRow[]>;

	/**
	 * Change a workspace member's role, recording an append-only audit event.
	 *
	 * Returns a stable error string on failure (not_found, last_admin).
	 */
	changeWorkspaceMemberRole(
		principal: SessionPrincipal,
		workspaceId: string,
		targetUserId: string,
		newRole: WorkspaceRole,
	): Promise<{ eventId: string } | { error: string }>;

	// --- Auth --------------------------------------------------------------------

	/**
	 * Register a new user with the email provider and open a session.
	 *
	 * Returns `{ error: "email_taken" }` when the email is already registered.
	 * The caller is responsible for setting the session cookie from `sessionToken`.
	 */
	register(
		email: string,
		password: string,
		displayName: string,
	): Promise<{ userId: string; sessionToken: string } | { error: string }>;

	/**
	 * Authenticate with email + password, open a session, and return the raw
	 * session token. Returns a stable error code on failure.
	 */
	login(
		email: string,
		password: string,
	): Promise<{ userId: string; sessionToken: string } | { error: string }>;

	/**
	 * Resolve a session token to a user id for the cookie-based context factory.
	 *
	 * Returns `null` when the token is invalid, expired, or invalidated.
	 */
	resolveSession(token: string): Promise<string | null>;

	/**
	 * Invalidate the session identified by the raw token (logout).
	 *
	 * A no-op when the token does not correspond to an active session.
	 */
	invalidateSession(token: string): Promise<void>;

	/**
	 * Authenticate or provision a user via GitHub OAuth and open a new session.
	 *
	 * Resolution order: existing GitHub identity → email match (link) → new user.
	 * Returns a stable error code on conflict. The caller sets the session cookie.
	 */
	loginWithGitHub(args: {
		githubUserId: string;
		githubLogin: string;
		githubName: string | null;
		/** Primary verified email from /user/emails; null if unavailable. */
		verifiedEmail: string | null;
	}): Promise<LoginWithGitHubResult | { error: string }>;

	/**
	 * Authenticate or provision a user via the central OIDC provider and open a
	 * new session.
	 *
	 * Resolution order mirrors {@link DataSource.loginWithGitHub}; the workspace
	 * role asserted by the IdP is re-synced on every login. The caller sets the
	 * session cookie.
	 */
	loginWithOidc(args: {
		/** Stable OIDC `sub` claim. */
		subject: string;
		/** Email claim when `email_verified` was true; null otherwise. */
		verifiedEmail: string | null;
		/** Display-name claim; null when absent. */
		name: string | null;
		/** Workspace role mapped from IdP roles/groups. */
		workspaceRole: "admin" | "member";
	}): Promise<LoginWithOidcResult | { error: string }>;
}
