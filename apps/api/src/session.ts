/**
 * Dev session model (NO real auth this phase).
 *
 * Authentication is explicitly deferred (see docs/architecture/auth-and-identity.md
 * "Deferred work"): there is no token issuance, no password/JWT/cookie handling.
 * Instead the acting user is taken from a dev request header, `x-tundra-user-id`,
 * defaulting to `user-ada`. The header value is mapped to a {@link SessionPrincipal}
 * either by `loadSessionPrincipal` (db mode) or by a fixture builder here (mock
 * mode). When real auth lands this header path is replaced by session validation;
 * the rest of the API already consumes a `SessionPrincipal` and will not change.
 */

import {
	ActionSource,
	WorkspaceRole,
	permissionsForProjectRole,
	permissionsForWorkspaceRole,
} from "@tundra/domain";
import { ProjectRole } from "@tundra/domain";
import type { Permission, SessionPrincipal, UserId, WorkspaceId } from "@tundra/domain";

/** The dev header that selects the acting user in the absence of real auth. */
export const DEV_USER_HEADER = "x-tundra-user-id";

/** The user assumed when the dev header is absent. */
export const DEFAULT_DEV_USER_ID = "user-ada";

const MOCK_WORKSPACE_ID = "ws-tundra" as WorkspaceId;

/** Workspace role assigned to each fixture user in mock mode. */
const MOCK_WORKSPACE_ROLES: Readonly<Record<string, WorkspaceRole>> = {
	"user-ada": WorkspaceRole.Admin,
	"user-bob": WorkspaceRole.Member,
};

/** Project roles assigned to each fixture user in mock mode (mirrors seedDev). */
const MOCK_PROJECT_ROLES: Readonly<Record<string, Readonly<Record<string, ProjectRole>>>> = {
	"user-ada": { "proj-core": ProjectRole.Owner },
	"user-bob": { "proj-core": ProjectRole.Member },
};

/**
 * Build a fixture {@link SessionPrincipal} for mock mode. Composes the workspace
 * role's permissions with the per-project roles' permissions exactly as
 * `loadSessionPrincipal` does in db mode, so authorization behaves identically in
 * both backends. Unknown users fall back to a workspace `Member`.
 */
export function buildMockPrincipal(userId: string): SessionPrincipal {
	const workspaceRole = MOCK_WORKSPACE_ROLES[userId] ?? WorkspaceRole.Member;
	const projectRoles = MOCK_PROJECT_ROLES[userId] ?? {};

	const permissions = new Set<Permission>();
	for (const permission of permissionsForWorkspaceRole(workspaceRole)) {
		permissions.add(permission);
	}
	for (const role of Object.values(projectRoles)) {
		for (const permission of permissionsForProjectRole(role)) {
			permissions.add(permission);
		}
	}

	return {
		userId: userId as UserId,
		source: ActionSource.User,
		workspaceId: MOCK_WORKSPACE_ID,
		workspaceRole,
		projectRoles,
		permissions: [...permissions],
	};
}

/**
 * Build the principal for a request with no valid session when the dev-header
 * fallback is disabled (production): no user, no workspace, no permissions.
 * Resolvers treat it like any unauthenticated principal.
 */
export function buildAnonymousPrincipal(): SessionPrincipal {
	return {
		source: ActionSource.User,
		permissions: [],
	};
}

/** Read the dev user id from request headers, defaulting when absent. */
export function devUserIdFromHeaders(headers: Headers): string {
	const raw = headers.get(DEV_USER_HEADER);
	const trimmed = raw?.trim();
	return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_DEV_USER_ID;
}
