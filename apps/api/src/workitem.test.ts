/**
 * Tests for createWorkItem and updateWorkItem mutations.
 */

import { describe, expect, it } from "vitest";

import { createTestHarness } from "./test-helpers.js";
import { ADA, BOB } from "./mock-data.js";

interface CreateWorkItemResult {
	createWorkItem: {
		workItem: { id: string; title: string; status: string; priority: string };
		eventId: string;
	};
}

interface UpdateWorkItemResult {
	updateWorkItem: { workItem: { id: string; title: string; priority: string }; eventId: string };
}

interface AuditHistoryResult {
	auditHistory: { id: string; action: string; targetId: string }[];
}

const CREATE_WORK_ITEM = /* GraphQL */ `
	mutation CreateWorkItem(
		$projectId: ID!
		$title: String!
		$source: WorkItemSource!
		$priority: WorkItemPriority!
	) {
		createWorkItem(projectId: $projectId, title: $title, source: $source, priority: $priority) {
			workItem {
				id
				title
				status
				priority
			}
			eventId
		}
	}
`;

const UPDATE_WORK_ITEM = /* GraphQL */ `
	mutation UpdateWorkItem($workItemId: ID!, $title: String, $priority: WorkItemPriority) {
		updateWorkItem(workItemId: $workItemId, title: $title, priority: $priority) {
			workItem {
				id
				title
				priority
			}
			eventId
		}
	}
`;

const AUDIT_HISTORY = /* GraphQL */ `
	query AuditHistory($targetType: String!, $targetId: ID!) {
		auditHistory(targetType: $targetType, targetId: $targetId) {
			id
			action
			targetId
		}
	}
`;

describe("createWorkItem", () => {
	it("creates a new work item with status todo and records an audit event", async () => {
		const harness = createTestHarness();
		const result = await harness.run(ADA, CREATE_WORK_ITEM, {
			projectId: "proj-aurora",
			title: "Test task",
			source: "task",
			priority: "medium",
		});

		expect(result.errors).toBeUndefined();
		const data = result.data as unknown as CreateWorkItemResult;
		const { workItem, eventId } = data.createWorkItem;

		expect(workItem.title).toBe("Test task");
		expect(workItem.status).toBe("todo");
		expect(workItem.priority).toBe("medium");
		expect(workItem.id).toMatch(/^wi_/);
		expect(eventId).toBeTruthy();
	});

	it("records a workitem.created audit event visible in auditHistory", async () => {
		const harness = createTestHarness();
		const createResult = await harness.run(ADA, CREATE_WORK_ITEM, {
			projectId: "proj-aurora",
			title: "Audit test",
			source: "bug",
			priority: "high",
		});
		expect(createResult.errors).toBeUndefined();
		const { workItem, eventId } = (createResult.data as unknown as CreateWorkItemResult)
			.createWorkItem;

		const historyResult = await harness.run(ADA, AUDIT_HISTORY, {
			targetType: "WorkItem",
			targetId: workItem.id,
		});
		expect(historyResult.errors).toBeUndefined();
		const history = (historyResult.data as unknown as AuditHistoryResult).auditHistory;

		expect(history).toHaveLength(1);
		expect(history[0]?.id).toBe(eventId);
		expect(history[0]?.action).toBe("workitem.created");
		expect(history[0]?.targetId).toBe(workItem.id);
	});
});

describe("updateWorkItem", () => {
	it("updates title and priority of an existing work item", async () => {
		const harness = createTestHarness();

		// First create a work item.
		const createResult = await harness.run(ADA, CREATE_WORK_ITEM, {
			projectId: "proj-aurora",
			title: "Original title",
			source: "task",
			priority: "low",
		});
		expect(createResult.errors).toBeUndefined();
		const { workItem } = (createResult.data as unknown as CreateWorkItemResult).createWorkItem;

		// Now update it.
		const updateResult = await harness.run(ADA, UPDATE_WORK_ITEM, {
			workItemId: workItem.id,
			title: "Updated title",
			priority: "urgent",
		});
		expect(updateResult.errors).toBeUndefined();
		const data = updateResult.data as unknown as UpdateWorkItemResult;
		expect(data.updateWorkItem.workItem.title).toBe("Updated title");
		expect(data.updateWorkItem.workItem.priority).toBe("urgent");
		expect(data.updateWorkItem.eventId).toBeTruthy();
	});

	it("records a workitem.updated audit event", async () => {
		const harness = createTestHarness();

		const createResult = await harness.run(BOB, CREATE_WORK_ITEM, {
			projectId: "proj-aurora",
			title: "To update",
			source: "task",
			priority: "medium",
		});
		const { workItem } = (createResult.data as unknown as CreateWorkItemResult).createWorkItem;

		await harness.run(BOB, UPDATE_WORK_ITEM, { workItemId: workItem.id, title: "Updated" });

		const historyResult = await harness.run(BOB, AUDIT_HISTORY, {
			targetType: "WorkItem",
			targetId: workItem.id,
		});
		const history = (historyResult.data as unknown as AuditHistoryResult).auditHistory;

		const events = history.map((e) => e.action);
		expect(events).toContain("workitem.created");
		expect(events).toContain("workitem.updated");
	});
});
