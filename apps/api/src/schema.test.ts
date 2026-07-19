import { describe, expect, it } from "vitest";

import { createTestHarness } from "./test-helpers.js";
import { ADA } from "./mock-data.js";

interface WorkItemResult {
	id: string;
	source: string;
	title: string;
	status: string;
	assigneeId: string | null;
}

interface MyTasksData {
	myTasks: WorkItemResult[];
}

describe("GraphQL schema", () => {
	it("returns mixed-source My Tasks for an assignee, excluding Done/Cancelled", async () => {
		const harness = createTestHarness();
		const result = await harness.run(
			ADA,
			/* GraphQL */ `
				query ($assigneeId: ID) {
					myTasks(assigneeId: $assigneeId) {
						id
						source
						title
						status
						assigneeId
					}
				}
			`,
			{ assigneeId: ADA },
		);

		expect(result.errors).toBeUndefined();
		const data = result.data as unknown as MyTasksData;
		const items = data.myTasks;

		// every returned item is assigned to ADA and active
		expect(items.length).toBeGreaterThan(0);
		for (const item of items) {
			expect(item.assigneeId).toBe(ADA);
			expect(["done", "cancelled"]).not.toContain(item.status);
		}

		// the result spans multiple distinct sources (proves unified aggregation)
		const sources = new Set(items.map((i) => i.source));
		expect(sources.size).toBeGreaterThanOrEqual(5);
		expect(sources.has("task")).toBe(true);
		expect(sources.has("story_checklist")).toBe(true);
		expect(sources.has("extension")).toBe(true);
	});

	it("defaults myTasks to the viewer when assigneeId is omitted", async () => {
		const harness = createTestHarness();
		const result = await harness.run(
			ADA,
			/* GraphQL */ `
				{
					myTasks {
						id
						assigneeId
					}
				}
			`,
		);
		expect(result.errors).toBeUndefined();
		const data = result.data as unknown as MyTasksData;
		expect(data.myTasks.length).toBeGreaterThan(0);
		for (const item of data.myTasks) {
			expect(item.assigneeId).toBe(ADA);
		}
	});

	it("answers the health query", async () => {
		const harness = createTestHarness();
		const result = await harness.run(ADA, "{ health }");
		expect(result.errors).toBeUndefined();
		expect((result.data as { health: string }).health).toBe("ok");
	});

	it("lists projects and modules", async () => {
		const harness = createTestHarness();
		const result = await harness.run(
			ADA,
			"{ projects { id key } modules { id name providesWorkItemSources } }",
		);
		expect(result.errors).toBeUndefined();
		const data = result.data as {
			projects: { id: string; key: string }[];
			modules: { id: string; name: string; providesWorkItemSources: string[] }[];
		};
		expect(data.projects.length).toBeGreaterThanOrEqual(2);
		expect(data.modules[0]?.providesWorkItemSources).toContain("extension");
	});
});
