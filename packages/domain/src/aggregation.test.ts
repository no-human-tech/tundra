import { describe, expect, it } from "vitest";

import { selectMyTasks, isActiveStatus } from "./aggregation.js";
import { WorkItemPriority, WorkItemSource, WorkItemStatus } from "./enums.js";
import type { ProjectId, UserId, WorkItemId } from "./ids.js";
import type { WorkItem } from "./work-item.js";

const ada = "user-ada" as UserId;
const bob = "user-bob" as UserId;
const projA = "proj-a" as ProjectId;
const projB = "proj-b" as ProjectId;

function wi(overrides: Partial<WorkItem> & Pick<WorkItem, "id" | "source">): WorkItem {
	return {
		projectId: projA,
		sourceRef: { source: overrides.source, refId: String(overrides.id) },
		title: "item",
		status: WorkItemStatus.Todo,
		priority: WorkItemPriority.Medium,
		assigneeId: ada,
		createdAt: "2026-06-01T00:00:00.000Z",
		updatedAt: "2026-06-01T00:00:00.000Z",
		...overrides,
	};
}

describe("isActiveStatus", () => {
	it("treats Done and Cancelled as inactive, everything else active", () => {
		expect(isActiveStatus(WorkItemStatus.Todo)).toBe(true);
		expect(isActiveStatus(WorkItemStatus.InProgress)).toBe(true);
		expect(isActiveStatus(WorkItemStatus.Blocked)).toBe(true);
		expect(isActiveStatus(WorkItemStatus.Done)).toBe(false);
		expect(isActiveStatus(WorkItemStatus.Cancelled)).toBe(false);
	});
});

describe("selectMyTasks", () => {
	it("aggregates a mixed-source set for one assignee, excluding Done/Cancelled by default", () => {
		const items: WorkItem[] = [
			wi({ id: "w1" as WorkItemId, source: WorkItemSource.Task }),
			wi({ id: "w2" as WorkItemId, source: WorkItemSource.StoryChecklist }),
			wi({ id: "w3" as WorkItemId, source: WorkItemSource.Subtask }),
			wi({ id: "w4" as WorkItemId, source: WorkItemSource.Bug }),
			wi({ id: "w5" as WorkItemId, source: WorkItemSource.Review }),
			wi({ id: "w6" as WorkItemId, source: WorkItemSource.Docs }),
			wi({ id: "w7" as WorkItemId, source: WorkItemSource.Automation }),
			wi({ id: "w8" as WorkItemId, source: WorkItemSource.Extension }),
			// excluded: wrong assignee
			wi({ id: "w9" as WorkItemId, source: WorkItemSource.Task, assigneeId: bob }),
			// excluded: terminal statuses
			wi({ id: "w10" as WorkItemId, source: WorkItemSource.Task, status: WorkItemStatus.Done }),
			wi({
				id: "w11" as WorkItemId,
				source: WorkItemSource.Task,
				status: WorkItemStatus.Cancelled,
			}),
		];

		const result = selectMyTasks(items, { assigneeId: ada });
		const ids = result.map((r) => r.id);

		expect(ids).toEqual(["w1", "w2", "w3", "w4", "w5", "w6", "w7", "w8"]);

		// every one of the eight source kinds is represented exactly once
		const sources = new Set(result.map((r) => r.source));
		expect(sources.size).toBe(8);
	});

	it("excludes items assigned to other users", () => {
		const items: WorkItem[] = [
			wi({ id: "w1" as WorkItemId, source: WorkItemSource.Task, assigneeId: ada }),
			wi({ id: "w2" as WorkItemId, source: WorkItemSource.Task, assigneeId: bob }),
		];
		const result = selectMyTasks(items, { assigneeId: bob });
		expect(result.map((r) => r.id)).toEqual(["w2"]);
	});

	it("honors includeStatuses, which overrides the default active-only behaviour", () => {
		const items: WorkItem[] = [
			wi({ id: "w1" as WorkItemId, source: WorkItemSource.Task, status: WorkItemStatus.Done }),
			wi({ id: "w2" as WorkItemId, source: WorkItemSource.Task, status: WorkItemStatus.Todo }),
		];
		const result = selectMyTasks(items, {
			assigneeId: ada,
			includeStatuses: [WorkItemStatus.Done],
		});
		expect(result.map((r) => r.id)).toEqual(["w1"]);
	});

	it("narrows by projectId when provided", () => {
		const items: WorkItem[] = [
			wi({ id: "w1" as WorkItemId, source: WorkItemSource.Task, projectId: projA }),
			wi({ id: "w2" as WorkItemId, source: WorkItemSource.Task, projectId: projB }),
		];
		const result = selectMyTasks(items, { assigneeId: ada, projectId: projB });
		expect(result.map((r) => r.id)).toEqual(["w2"]);
	});

	it("narrows by source set when provided", () => {
		const items: WorkItem[] = [
			wi({ id: "w1" as WorkItemId, source: WorkItemSource.Task }),
			wi({ id: "w2" as WorkItemId, source: WorkItemSource.Bug }),
			wi({ id: "w3" as WorkItemId, source: WorkItemSource.Review }),
		];
		const result = selectMyTasks(items, {
			assigneeId: ada,
			sources: [WorkItemSource.Bug, WorkItemSource.Review],
		});
		expect(result.map((r) => r.id)).toEqual(["w2", "w3"]);
	});

	it("returns an empty array when nothing matches", () => {
		const items: WorkItem[] = [
			wi({ id: "w1" as WorkItemId, source: WorkItemSource.Task, assigneeId: bob }),
		];
		expect(selectMyTasks(items, { assigneeId: ada })).toEqual([]);
	});
});
