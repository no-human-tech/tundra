/** Tests for the pure pieces of the integration bus (no Kafka, no DB). */

import { describe, expect, it } from "vitest";

import { WorkItemPriority, WorkItemSource, WorkItemStatus } from "@tundra/domain";
import type { OutboxRow } from "@tundra/db";

import { groupByTopic, mapInboundToWorkItem } from "./integration-bus.js";

describe("mapInboundToWorkItem", () => {
	it("derives a stable id from module + external id and defaults status/priority", () => {
		const item = mapInboundToWorkItem({
			kind: "workitem.upsert",
			projectId: "proj-core",
			externalId: "TICKET-42",
			moduleId: "mod.helpdesk",
			title: "Handle escalation",
		});
		expect(item.id).toBe("wi-ext-mod.helpdesk-TICKET-42");
		expect(item.source).toBe(WorkItemSource.Extension);
		expect(item.sourceRef).toEqual({
			source: WorkItemSource.Extension,
			refId: "TICKET-42",
			moduleId: "mod.helpdesk",
		});
		expect(item.status).toBe(WorkItemStatus.Todo);
		expect(item.priority).toBe(WorkItemPriority.Medium);
	});

	it("passes through explicit status, priority, assignee, and metadata", () => {
		const item = mapInboundToWorkItem({
			kind: "workitem.upsert",
			projectId: "proj-core",
			externalId: "T-1",
			moduleId: "mod.x",
			title: "T",
			status: WorkItemStatus.InProgress,
			priority: WorkItemPriority.Urgent,
			assigneeId: "user-ada",
			dueDate: "2026-08-01",
			metadata: { origin: "x" },
		});
		expect(item.status).toBe(WorkItemStatus.InProgress);
		expect(item.priority).toBe(WorkItemPriority.Urgent);
		expect(item.assigneeId).toBe("user-ada");
		expect(item.metadata).toEqual({ origin: "x" });
	});
});

describe("groupByTopic", () => {
	it("buckets rows by topic preserving per-topic order", () => {
		const row = (id: string, topic: string): OutboxRow => ({
			id,
			topic,
			key: null,
			payload: {},
			attempts: 0,
		});
		const grouped = groupByTopic([
			row("1", "tundra.events.workitem"),
			row("2", "tundra.events.audit"),
			row("3", "tundra.events.workitem"),
		]);
		expect([...grouped.keys()]).toEqual(["tundra.events.workitem", "tundra.events.audit"]);
		expect(grouped.get("tundra.events.workitem")?.map((r) => r.id)).toEqual(["1", "3"]);
	});
});
