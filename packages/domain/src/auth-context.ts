/**
 * The resolved security context for a single request or operation.
 *
 * A {@link SessionPrincipal} carries the acting user (if any), the action
 * source, the active workspace/project scope and roles, and the flattened set
 * of permissions. Helpers answer the questions the rest of the domain asks of
 * it. Pure; resolution of the principal itself happens outside the domain.
 *
 * See architect auth-foundation report §auth-context.
 */

import type { ProjectRole } from "./enums.js";
import type { UserId, WorkspaceId } from "./ids.js";
import type { ActionSource } from "./audit.js";
import type { Permission } from "./authz.js";
import { WorkspaceRole } from "./authz.js";

/** The acting identity and authority for one operation. */
export interface SessionPrincipal {
	/** Unset for unauthenticated or non-user (system/automation) principals. */
	userId?: UserId;
	source: ActionSource;
	workspaceId?: WorkspaceId;
	workspaceRole?: WorkspaceRole;
	/** Per-project roles, keyed by `ProjectId` string. */
	projectRoles?: Readonly<Record<string, ProjectRole>>;
	/** Flattened permission set the principal holds. */
	permissions: readonly Permission[];
	/** When true, bypasses permission and admin checks. */
	isSuperAdmin?: boolean;
}

/**
 * Whether a principal holds a permission. Super admins always pass.
 *
 * @param principal The security context to check.
 * @param permission The permission string required.
 */
export function hasPermission(principal: SessionPrincipal, permission: Permission): boolean {
	if (principal.isSuperAdmin === true) {
		return true;
	}
	return principal.permissions.includes(permission);
}

/**
 * Whether a principal has workspace-administrative authority — a super admin, or
 * a member whose workspace role is Owner or Admin.
 *
 * @param principal The security context to check.
 */
export function isWorkspaceAdmin(principal: SessionPrincipal): boolean {
	if (principal.isSuperAdmin === true) {
		return true;
	}
	return (
		principal.workspaceRole === WorkspaceRole.Owner ||
		principal.workspaceRole === WorkspaceRole.Admin
	);
}
