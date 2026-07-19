import { describe, expect, it } from "vitest";

import { ProjectRole } from "./enums.js";
import { WorkspaceRole, permissionsForProjectRole, permissionsForWorkspaceRole } from "./authz.js";
import { hasPermission, isWorkspaceAdmin } from "./auth-context.js";
import type { SessionPrincipal } from "./auth-context.js";
import { ActionSource } from "./audit.js";

function principal(overrides: Partial<SessionPrincipal> = {}): SessionPrincipal {
	return {
		source: ActionSource.User,
		permissions: [],
		...overrides,
	};
}

describe("permissionsForWorkspaceRole", () => {
	it("grants Owner and Admin the full audit surface including revert:any", () => {
		for (const role of [WorkspaceRole.Owner, WorkspaceRole.Admin]) {
			const perms = permissionsForWorkspaceRole(role);
			expect(perms).toContain("audit:read");
			expect(perms).toContain("audit:revert");
			expect(perms).toContain("audit:revert:any");
		}
	});

	it("grants Member read + revert (own), but not revert:any", () => {
		const perms = permissionsForWorkspaceRole(WorkspaceRole.Member);
		expect(perms).toContain("audit:read");
		expect(perms).toContain("audit:revert");
		expect(perms).not.toContain("audit:revert:any");
	});

	it("grants Guest read only", () => {
		const perms = permissionsForWorkspaceRole(WorkspaceRole.Guest);
		expect(perms).toContain("audit:read");
		expect(perms).not.toContain("audit:revert");
		expect(perms).not.toContain("audit:revert:any");
	});
});

describe("permissionsForProjectRole", () => {
	it("grants Owner and Admin revert:any", () => {
		for (const role of [ProjectRole.Owner, ProjectRole.Admin]) {
			expect(permissionsForProjectRole(role)).toContain("audit:revert:any");
		}
	});

	it("grants Member revert (own) but not revert:any", () => {
		const perms = permissionsForProjectRole(ProjectRole.Member);
		expect(perms).toContain("audit:revert");
		expect(perms).not.toContain("audit:revert:any");
	});

	it("grants Viewer read only", () => {
		const perms = permissionsForProjectRole(ProjectRole.Viewer);
		expect(perms).toContain("audit:read");
		expect(perms).not.toContain("audit:revert");
	});
});

describe("hasPermission", () => {
	it("is true when the permission is in the set", () => {
		expect(hasPermission(principal({ permissions: ["audit:read"] }), "audit:read")).toBe(true);
	});

	it("is false when the permission is absent", () => {
		expect(hasPermission(principal({ permissions: ["audit:read"] }), "audit:revert")).toBe(false);
	});

	it("short-circuits to true for a super admin regardless of the set", () => {
		expect(hasPermission(principal({ permissions: [], isSuperAdmin: true }), "anything")).toBe(
			true,
		);
	});
});

describe("isWorkspaceAdmin", () => {
	it("is true for Owner and Admin workspace roles", () => {
		expect(isWorkspaceAdmin(principal({ workspaceRole: WorkspaceRole.Owner }))).toBe(true);
		expect(isWorkspaceAdmin(principal({ workspaceRole: WorkspaceRole.Admin }))).toBe(true);
	});

	it("is false for Member and Guest workspace roles", () => {
		expect(isWorkspaceAdmin(principal({ workspaceRole: WorkspaceRole.Member }))).toBe(false);
		expect(isWorkspaceAdmin(principal({ workspaceRole: WorkspaceRole.Guest }))).toBe(false);
	});

	it("is false when no workspace role is set", () => {
		expect(isWorkspaceAdmin(principal())).toBe(false);
	});

	it("short-circuits to true for a super admin", () => {
		expect(isWorkspaceAdmin(principal({ isSuperAdmin: true }))).toBe(true);
	});
});
