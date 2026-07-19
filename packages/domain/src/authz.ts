/**
 * Authorization model — workspace membership, roles, and the permission sets
 * each role grants.
 *
 * Permissions are plain strings (a `"resource:action"` convention) so modules
 * can contribute their own without changing the core. The role→permission maps
 * are pure and deterministic.
 *
 * See architect auth-foundation report §authz.
 */

import type { ISODateString, UserId, WorkspaceId, WorkspaceMembershipId } from "./ids.js";
import type { Entity } from "./ids.js";
import { ProjectRole } from "./enums.js";

/** A member's role within a workspace. */
export enum WorkspaceRole {
	Owner = "owner",
	Admin = "admin",
	Member = "member",
	Guest = "guest",
}

/** Records that a user belongs to a workspace with a given role. */
export interface WorkspaceMembership extends Entity<WorkspaceMembershipId> {
	workspaceId: WorkspaceId;
	userId: UserId;
	role: WorkspaceRole;
	joinedAt: ISODateString;
}

/** A capability string, e.g. "audit:read". Modules may define their own. */
export type Permission = string;

/**
 * The permissions granted by a workspace role.
 *
 * Owners and Admins get the full audit surface including reverting other users'
 * actions; Members may read and revert their own; Guests may only read.
 *
 * @param role The workspace role to resolve permissions for.
 */
export function permissionsForWorkspaceRole(role: WorkspaceRole): readonly Permission[] {
	switch (role) {
		case WorkspaceRole.Owner:
		case WorkspaceRole.Admin:
			return [
				"workspace:read",
				"workspace:manage",
				"member:manage",
				"project:create",
				"audit:read",
				"audit:revert",
				"audit:revert:any",
			];
		case WorkspaceRole.Member:
			return ["workspace:read", "project:create", "audit:read", "audit:revert"];
		case WorkspaceRole.Guest:
			return ["workspace:read", "audit:read"];
	}
}

/**
 * The permissions granted by a project role.
 *
 * Owners and Admins manage the project and may revert any action within it;
 * Members may read and revert their own; Viewers may only read.
 *
 * @param role The project role to resolve permissions for.
 */
export function permissionsForProjectRole(role: ProjectRole): readonly Permission[] {
	switch (role) {
		case ProjectRole.Owner:
		case ProjectRole.Admin:
			return [
				"project:read",
				"project:manage",
				"workitem:write",
				"audit:read",
				"audit:revert",
				"audit:revert:any",
			];
		case ProjectRole.Member:
			return ["project:read", "workitem:write", "audit:read", "audit:revert"];
		case ProjectRole.Viewer:
			return ["project:read", "audit:read"];
	}
}
