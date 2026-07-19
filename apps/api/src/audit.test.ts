import { describe, expect, it } from "vitest";

import { createTestHarness } from "./test-helpers.js";
import type { TestHarness } from "./test-helpers.js";
import { ADA, BOB } from "./mock-data.js";

const CHANGE_STATUS = /* GraphQL */ `
	mutation ($workItemId: ID!, $status: WorkItemStatus!) {
		changeWorkItemStatus(workItemId: $workItemId, status: $status) {
			workItem {
				id
				status
			}
			eventId
		}
	}
`;

const REVERT = /* GraphQL */ `
	mutation ($eventId: ID!) {
		revertAuditEvent(eventId: $eventId) {
			allowed
			reason
			eventId
		}
	}
`;

const HISTORY = /* GraphQL */ `
	query ($targetType: String!, $targetId: ID!) {
		auditHistory(targetType: $targetType, targetId: $targetId) {
			id
			action
			source
			actorUserId
			reversibility
			reversalOfEventId
			before
			after
			inverse
		}
	}
`;

interface ChangeData {
	changeWorkItemStatus: { workItem: { id: string; status: string }; eventId: string };
}
interface RevertData {
	revertAuditEvent: { allowed: boolean; reason: string | null; eventId: string | null };
}
interface AuditEventGql {
	id: string;
	action: string;
	source: string;
	actorUserId: string | null;
	reversibility: string;
	reversalOfEventId: string | null;
	before: string | null;
	after: string | null;
	inverse: string | null;
}
interface HistoryData {
	auditHistory: AuditEventGql[];
}

/** Change a work item's status and return the recorded event id. */
async function changeStatus(
	harness: TestHarness,
	userId: string,
	workItemId: string,
	status: string,
): Promise<string> {
	const result = await harness.run(userId, CHANGE_STATUS, { workItemId, status });
	expect(result.errors).toBeUndefined();
	return (result.data as unknown as ChangeData).changeWorkItemStatus.eventId;
}

async function history(
	harness: TestHarness,
	userId: string,
	targetId: string,
): Promise<AuditEventGql[]> {
	const result = await harness.run(userId, HISTORY, { targetType: "WorkItem", targetId });
	expect(result.errors).toBeUndefined();
	return (result.data as unknown as HistoryData).auditHistory;
}

describe("reversible-action PoC (mock backend, no DB)", () => {
	it("changeWorkItemStatus records a reversible audit event surfaced by auditHistory", async () => {
		const harness = createTestHarness();
		const change = await harness.run(ADA, CHANGE_STATUS, {
			workItemId: "wi-task-1",
			status: "done",
		});
		expect(change.errors).toBeUndefined();
		const data = change.data as unknown as ChangeData;
		expect(data.changeWorkItemStatus.workItem.status).toBe("done");
		const eventId = data.changeWorkItemStatus.eventId;
		expect(eventId).toMatch(/^evt_/);

		const events = await history(harness, ADA, "wi-task-1");
		expect(events).toHaveLength(1);
		const event = events[0]!;
		expect(event.id).toBe(eventId);
		expect(event.action).toBe("workitem.status_changed");
		expect(event.source).toBe("user");
		expect(event.actorUserId).toBe(ADA);
		expect(event.reversibility).toBe("reversible");
		// JSON snapshots carry the status change.
		expect(JSON.parse(event.before!)).toEqual({ status: "in_progress" });
		expect(JSON.parse(event.after!)).toEqual({ status: "done" });
		expect(JSON.parse(event.inverse!)).toEqual({ status: "in_progress" });
	});

	it("lets the actor revert their own action", async () => {
		const harness = createTestHarness();
		const eventId = await changeStatus(harness, ADA, "wi-task-1", "done");

		const result = await harness.run(ADA, REVERT, { eventId });
		expect(result.errors).toBeUndefined();
		const revert = (result.data as unknown as RevertData).revertAuditEvent;
		expect(revert.allowed).toBe(true);
		expect(revert.reason).toBeNull();
		expect(revert.eventId).toMatch(/^evt_/);
		expect(revert.eventId).not.toBe(eventId);
	});

	it("denies a different non-admin reverting another's action (NotAuthorized)", async () => {
		const harness = createTestHarness();
		// Bob changes his own item, Ada... no — we want a non-admin reverting another's.
		// Bob is the non-admin; have Ada (admin) act, then Bob try to revert it.
		const adaEventId = await changeStatus(harness, ADA, "wi-task-1", "done");

		const result = await harness.run(BOB, REVERT, { eventId: adaEventId });
		expect(result.errors).toBeUndefined();
		const revert = (result.data as unknown as RevertData).revertAuditEvent;
		expect(revert.allowed).toBe(false);
		expect(revert.reason).toBe("not_authorized");
		expect(revert.eventId).toBeNull();
	});

	it("lets an admin revert another user's action", async () => {
		const harness = createTestHarness();
		// Bob (member) changes his own item, Ada (admin) reverts it.
		const bobEventId = await changeStatus(harness, BOB, "wi-task-bob", "done");

		const result = await harness.run(ADA, REVERT, { eventId: bobEventId });
		expect(result.errors).toBeUndefined();
		const revert = (result.data as unknown as RevertData).revertAuditEvent;
		expect(revert.allowed).toBe(true);
		expect(revert.eventId).toMatch(/^evt_/);
	});

	it("rejects reverting an already-reverted event (AlreadyReverted)", async () => {
		const harness = createTestHarness();
		const eventId = await changeStatus(harness, ADA, "wi-task-1", "done");

		const first = await harness.run(ADA, REVERT, { eventId });
		expect((first.data as unknown as RevertData).revertAuditEvent.allowed).toBe(true);

		const second = await harness.run(ADA, REVERT, { eventId });
		const revert = (second.data as unknown as RevertData).revertAuditEvent;
		expect(revert.allowed).toBe(false);
		expect(revert.reason).toBe("already_reverted");
	});

	it("rejects reverting a compensating (irreversible) event", async () => {
		const harness = createTestHarness();
		const eventId = await changeStatus(harness, ADA, "wi-task-1", "done");
		const first = await harness.run(ADA, REVERT, { eventId });
		const compensatingId = (first.data as unknown as RevertData).revertAuditEvent.eventId!;

		const result = await harness.run(ADA, REVERT, { eventId: compensatingId });
		const revert = (result.data as unknown as RevertData).revertAuditEvent;
		expect(revert.allowed).toBe(false);
		// makeReversalEvent marks the compensating event irreversible.
		expect(revert.reason).toBe("not_reversible");
	});

	it("rejects reverting a missing event (NotFound)", async () => {
		const harness = createTestHarness();
		const result = await harness.run(ADA, REVERT, { eventId: "evt_does_not_exist" });
		const revert = (result.data as unknown as RevertData).revertAuditEvent;
		expect(revert.allowed).toBe(false);
		expect(revert.reason).toBe("not_found");
	});

	it("is append-only: the original event survives a revert and a compensating event is added", async () => {
		const harness = createTestHarness();
		const originalId = await changeStatus(harness, ADA, "wi-task-1", "done");

		const before = await history(harness, ADA, "wi-task-1");
		expect(before).toHaveLength(1);

		const revertResult = await harness.run(ADA, REVERT, { eventId: originalId });
		const compensatingId = (revertResult.data as unknown as RevertData).revertAuditEvent.eventId!;

		const after = await history(harness, ADA, "wi-task-1");
		// Original is still present, unchanged, plus the new compensating event.
		expect(after).toHaveLength(2);
		const original = after.find((e) => e.id === originalId);
		expect(original).toBeDefined();
		expect(original!.reversalOfEventId).toBeNull();
		expect(JSON.parse(original!.after!)).toEqual({ status: "done" });

		const compensating = after.find((e) => e.id === compensatingId);
		expect(compensating).toBeDefined();
		expect(compensating!.reversalOfEventId).toBe(originalId);
		expect(compensating!.reversibility).toBe("irreversible");

		// The work item's status was restored to the pre-change value.
		const tasks = await harness.run(
			ADA,
			/* GraphQL */ `
				{
					myTasks {
						id
						status
					}
				}
			`,
		);
		const items = (tasks.data as unknown as { myTasks: { id: string; status: string }[] }).myTasks;
		const restored = items.find((i) => i.id === "wi-task-1");
		expect(restored?.status).toBe("in_progress");
	});
});
