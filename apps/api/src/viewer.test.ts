import { describe, expect, it } from "vitest";

import { createTestHarness } from "./test-helpers.js";
import { ADA, BOB } from "./mock-data.js";

interface ViewerData {
	viewer: {
		userId: string;
		displayName: string;
		workspaceId: string | null;
		workspaceRole: string | null;
		permissions: string[];
		isWorkspaceAdmin: boolean;
	};
}

const VIEWER_QUERY = /* GraphQL */ `
	{
		viewer {
			userId
			displayName
			workspaceId
			workspaceRole
			permissions
			isWorkspaceAdmin
		}
	}
`;

describe("viewer", () => {
	it("reflects the Ada (workspace Admin) principal with admin permissions", async () => {
		const harness = createTestHarness();
		const result = await harness.run(ADA, VIEWER_QUERY);
		expect(result.errors).toBeUndefined();
		const { viewer } = result.data as unknown as ViewerData;

		expect(viewer.userId).toBe(ADA);
		expect(viewer.displayName).toBe("Ada Lovelace");
		expect(viewer.workspaceId).toBe("ws-tundra");
		expect(viewer.workspaceRole).toBe("admin");
		expect(viewer.isWorkspaceAdmin).toBe(true);
		// Admin holds the elevated revert permission.
		expect(viewer.permissions).toContain("audit:revert:any");
		expect(viewer.permissions).toContain("audit:read");
	});

	it("reflects the Bob (workspace Member) principal without admin authority", async () => {
		const harness = createTestHarness();
		const result = await harness.run(BOB, VIEWER_QUERY);
		expect(result.errors).toBeUndefined();
		const { viewer } = result.data as unknown as ViewerData;

		expect(viewer.userId).toBe(BOB);
		expect(viewer.workspaceRole).toBe("member");
		expect(viewer.isWorkspaceAdmin).toBe(false);
		expect(viewer.permissions).toContain("audit:revert");
		expect(viewer.permissions).not.toContain("audit:revert:any");
	});
});
