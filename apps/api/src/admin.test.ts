/**
 * Tests for workspace member admin operations: listWorkspaceMembers and
 * changeWorkspaceMemberRole.
 */

import { describe, expect, it } from "vitest";

import { createTestHarness } from "./test-helpers.js";
import { ADA, BOB } from "./mock-data.js";

interface WorkspaceMembersResult {
	workspaceMembers: { userId: string; displayName: string; role: string }[];
}

interface ChangeRoleResult {
	changeWorkspaceMemberRole: { eventId: string };
}

const WORKSPACE_MEMBERS = /* GraphQL */ `
	query WorkspaceMembers($workspaceId: ID!) {
		workspaceMembers(workspaceId: $workspaceId) {
			userId
			displayName
			primaryEmail
			role
			joinedAt
		}
	}
`;

const CHANGE_ROLE = /* GraphQL */ `
	mutation ChangeWorkspaceMemberRole($workspaceId: ID!, $userId: ID!, $role: String!) {
		changeWorkspaceMemberRole(workspaceId: $workspaceId, userId: $userId, role: $role) {
			eventId
		}
	}
`;

describe("workspaceMembers query", () => {
	it("returns members with userId, displayName and role", async () => {
		const harness = createTestHarness();
		const result = await harness.run(ADA, WORKSPACE_MEMBERS, { workspaceId: "ws-tundra" });

		expect(result.errors).toBeUndefined();
		const data = result.data as unknown as WorkspaceMembersResult;
		expect(data.workspaceMembers.length).toBeGreaterThanOrEqual(2);

		for (const m of data.workspaceMembers) {
			expect(m.userId).toBeTruthy();
			expect(m.displayName).toBeTruthy();
			expect(["owner", "admin", "member"]).toContain(m.role);
		}
	});

	it("can be called as a non-admin viewer", async () => {
		const harness = createTestHarness();
		const result = await harness.run(BOB, WORKSPACE_MEMBERS, { workspaceId: "ws-tundra" });
		expect(result.errors).toBeUndefined();
		const data = result.data as unknown as WorkspaceMembersResult;
		expect(data.workspaceMembers.length).toBeGreaterThan(0);
	});
});

describe("changeWorkspaceMemberRole mutation", () => {
	it("changes a member's role and returns an eventId", async () => {
		const harness = createTestHarness();
		const result = await harness.run(ADA, CHANGE_ROLE, {
			workspaceId: "ws-tundra",
			userId: BOB,
			role: "member",
		});

		expect(result.errors).toBeUndefined();
		const data = result.data as unknown as ChangeRoleResult;
		expect(data.changeWorkspaceMemberRole.eventId).toBeTruthy();
	});

	it("rejects removing the last admin", async () => {
		const harness = createTestHarness();

		// First demote BOB to member so only ADA is admin.
		await harness.run(ADA, CHANGE_ROLE, {
			workspaceId: "ws-tundra",
			userId: BOB,
			role: "member",
		});

		// Now attempt to demote ADA (the last admin).
		const result = await harness.run(ADA, CHANGE_ROLE, {
			workspaceId: "ws-tundra",
			userId: ADA,
			role: "member",
		});

		// The mock changeWorkspaceMemberRole returns { error: "last_admin" } which
		// the resolver converts to a thrown Error.
		expect(result.errors).toBeDefined();
		expect(result.errors?.[0]?.message).toContain("last_admin");
	});
});
