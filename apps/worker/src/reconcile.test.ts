import { describe, expect, it } from "vitest";

import { WorkItemSource, WorkItemStatus, WorkItemPriority } from "@tundra/domain";
import type { ProjectId, UserId, WorkItem, WorkItemId } from "@tundra/domain";

import { collectProviderItems } from "./reconcile.js";
import type { WorkItemProviderLike } from "./reconcile.js";

const FIXED_AT = "2026-06-01T00:00:00.000Z";

function makeItem(id: string, projectId: string): WorkItem {
	return {
		id: id as WorkItemId,
		projectId: projectId as ProjectId,
		source: WorkItemSource.Extension,
		sourceRef: { source: WorkItemSource.Extension, refId: id },
		title: `Item ${id}`,
		status: WorkItemStatus.Todo,
		priority: WorkItemPriority.Medium,
		assigneeId: "user-ada" as UserId,
		createdAt: FIXED_AT,
		updatedAt: FIXED_AT,
	};
}

function fakeProvider(id: string, items: WorkItem[]): WorkItemProviderLike {
	return {
		id,
		fetch: (_projectId: string) => Promise.resolve(items),
	};
}

describe("collectProviderItems (no DB)", () => {
	it("returns an empty list when there are no providers", async () => {
		const items = await collectProviderItems("proj-core", []);
		expect(items).toEqual([]);
	});

	it("concatenates items from every provider in provider order", async () => {
		const providers = [
			fakeProvider("p1", [makeItem("wi-1", "proj-core"), makeItem("wi-2", "proj-core")]),
			fakeProvider("p2", [makeItem("wi-3", "proj-core")]),
		];
		const items = await collectProviderItems("proj-core", providers);
		expect(items.map((i) => i.id)).toEqual(["wi-1", "wi-2", "wi-3"]);
	});
});
