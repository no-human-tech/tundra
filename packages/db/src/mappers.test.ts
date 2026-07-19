/**
 * Unit tests for the pure row ↔ domain mappers and enum alignment. No database
 * required — these run in the default `pnpm test`.
 */

import { describe, expect, it } from "vitest";

import {
	ActionSource,
	Reversibility,
	WorkItemPriority,
	WorkItemSource,
	WorkItemStatus,
	WorkspaceRole,
} from "@tundra/domain";
import type {
	AuditEvent,
	AuditEventId,
	Project,
	ProjectId,
	UserId,
	User,
	WorkItem,
	WorkItemId,
	WorkspaceId,
} from "@tundra/domain";

import {
	auditEventToInsert,
	rowToAuditEvent,
	rowToProject,
	rowToUser,
	rowToWorkItem,
	workItemToInsert,
} from "./mappers.js";
import {
	actionSourceEnum,
	reversibilityEnum,
	workItemPriorityEnum,
	workItemSourceEnum,
	workItemStatusEnum,
	workspaceRoleEnum,
} from "./schema/enums.js";

const ISO = "2026-06-27T12:00:00.000Z";

describe("rowToWorkItem / workItemToInsert", () => {
	it("round-trips a WorkItem through insert and back", () => {
		const item: WorkItem = {
			id: "wi-1" as WorkItemId,
			projectId: "proj-core" as ProjectId,
			source: WorkItemSource.Extension,
			sourceRef: {
				source: WorkItemSource.Extension,
				refId: "ticket-1",
				moduleId: undefined,
			},
			title: "Helpdesk ticket",
			status: WorkItemStatus.InProgress,
			priority: WorkItemPriority.Urgent,
			assigneeId: "user-ada" as UserId,
			dueDate: ISO,
			metadata: { ticketId: "1" },
			createdAt: ISO,
			updatedAt: ISO,
		};

		const row = workItemToInsert(item);
		const back = rowToWorkItem(row);

		expect(back.id).toBe(item.id);
		expect(back.projectId).toBe(item.projectId);
		expect(back.source).toBe(WorkItemSource.Extension);
		expect(back.status).toBe(WorkItemStatus.InProgress);
		expect(back.priority).toBe(WorkItemPriority.Urgent);
		expect(back.assigneeId).toBe("user-ada");
		expect(back.dueDate).toBe(ISO);
		expect(back.metadata).toEqual({ ticketId: "1" });
		expect(back.sprintId).toBeUndefined();
	});

	it("maps null columns to undefined optional fields", () => {
		const item: WorkItem = {
			id: "wi-2" as WorkItemId,
			projectId: "proj-core" as ProjectId,
			source: WorkItemSource.Task,
			sourceRef: { source: WorkItemSource.Task, refId: "task-2" },
			title: "Bare task",
			status: WorkItemStatus.Todo,
			priority: WorkItemPriority.Low,
			createdAt: ISO,
			updatedAt: ISO,
		};

		const back = rowToWorkItem(workItemToInsert(item));
		expect(back.assigneeId).toBeUndefined();
		expect(back.dueDate).toBeUndefined();
		expect(back.sprintId).toBeUndefined();
		expect(back.metadata).toBeUndefined();
	});
});

describe("rowToProject", () => {
	it("maps a project row to the domain Project", () => {
		const project: Project = rowToProject({
			id: "proj-core",
			workspaceId: "ws-tundra",
			name: "Tundra Core",
			key: "TUN",
			slug: "tundra-core",
			description: "Aurora Platform",
			enabledModuleIds: ["mod-helpdesk"],
			archivedAt: null,
			createdAt: ISO,
			updatedAt: ISO,
		});

		expect(project.id).toBe("proj-core" as ProjectId);
		expect(project.workspaceId).toBe("ws-tundra" as WorkspaceId);
		expect(project.key).toBe("TUN");
		expect(project.enabledModuleIds).toEqual(["mod-helpdesk"]);
		expect(project.archivedAt).toBeUndefined();
	});
});

describe("rowToUser", () => {
	it("maps a user row to the domain User", () => {
		const user: User = rowToUser({
			id: "user-ada",
			primaryEmail: "ada@example.com",
			emailVerified: true,
			displayName: "Ada Lovelace",
			status: "active",
			createdAt: ISO,
			updatedAt: ISO,
		});

		expect(user.id).toBe("user-ada" as UserId);
		expect(user.primaryEmail).toBe("ada@example.com");
		expect(user.emailVerified).toBe(true);
		expect(user.status).toBe("active");
	});
});

describe("rowToAuditEvent / auditEventToInsert", () => {
	it("round-trips an AuditEvent through insert and back", () => {
		const event: AuditEvent = {
			id: "evt_1" as AuditEventId,
			actorUserId: "user-ada" as UserId,
			source: ActionSource.User,
			workspaceId: "ws-tundra" as WorkspaceId,
			projectId: "proj-core" as ProjectId,
			action: "workitem.status_changed",
			targetType: "WorkItem",
			targetId: "wi-1",
			occurredAt: ISO,
			before: { status: "todo" },
			after: { status: "in_progress" },
			inverse: { status: "todo" },
			reversibility: Reversibility.Reversible,
			createdAt: ISO,
			updatedAt: ISO,
		};

		const row = auditEventToInsert(event);
		// Append-only: the insert row carries no updatedAt column.
		expect("updatedAt" in row).toBe(false);

		const back = rowToAuditEvent(row);
		expect(back.id).toBe(event.id);
		expect(back.actorUserId).toBe("user-ada");
		expect(back.source).toBe(ActionSource.User);
		expect(back.action).toBe("workitem.status_changed");
		expect(back.before).toEqual({ status: "todo" });
		expect(back.after).toEqual({ status: "in_progress" });
		expect(back.inverse).toEqual({ status: "todo" });
		expect(back.reversibility).toBe(Reversibility.Reversible);
		// No updatedAt column: the Entity base mirrors createdAt.
		expect(back.updatedAt).toBe(back.createdAt);
	});

	it("maps absent optional payloads to undefined", () => {
		const event: AuditEvent = {
			id: "evt_2" as AuditEventId,
			source: ActionSource.System,
			action: "system.tick",
			targetType: "System",
			targetId: "n/a",
			occurredAt: ISO,
			reversibility: Reversibility.Irreversible,
			irreversibleReason: "system event",
			createdAt: ISO,
			updatedAt: ISO,
		};

		const back = rowToAuditEvent(auditEventToInsert(event));
		expect(back.actorUserId).toBeUndefined();
		expect(back.workspaceId).toBeUndefined();
		expect(back.before).toBeUndefined();
		expect(back.after).toBeUndefined();
		expect(back.inverse).toBeUndefined();
		expect(back.reversalOfEventId).toBeUndefined();
		expect(back.irreversibleReason).toBe("system event");
	});
});

describe("pgEnum alignment with @tundra/domain", () => {
	it("work_item_source enum includes every WorkItemSource value", () => {
		for (const value of Object.values(WorkItemSource)) {
			expect(workItemSourceEnum.enumValues).toContain(value);
		}
		expect(workItemSourceEnum.enumValues).toHaveLength(Object.values(WorkItemSource).length);
	});

	it("work_item_status enum includes every WorkItemStatus value", () => {
		for (const value of Object.values(WorkItemStatus)) {
			expect(workItemStatusEnum.enumValues).toContain(value);
		}
		expect(workItemStatusEnum.enumValues).toHaveLength(Object.values(WorkItemStatus).length);
	});

	it("work_item_priority enum includes every WorkItemPriority value", () => {
		for (const value of Object.values(WorkItemPriority)) {
			expect(workItemPriorityEnum.enumValues).toContain(value);
		}
	});

	it("workspace_role enum includes every WorkspaceRole value", () => {
		for (const value of Object.values(WorkspaceRole)) {
			expect(workspaceRoleEnum.enumValues).toContain(value);
		}
		expect(workspaceRoleEnum.enumValues).toHaveLength(Object.values(WorkspaceRole).length);
	});

	it("action_source enum includes every ActionSource value", () => {
		for (const value of Object.values(ActionSource)) {
			expect(actionSourceEnum.enumValues).toContain(value);
		}
		expect(actionSourceEnum.enumValues).toHaveLength(Object.values(ActionSource).length);
	});

	it("reversibility enum includes every Reversibility value", () => {
		for (const value of Object.values(Reversibility)) {
			expect(reversibilityEnum.enumValues).toContain(value);
		}
		expect(reversibilityEnum.enumValues).toHaveLength(Object.values(Reversibility).length);
	});
});
