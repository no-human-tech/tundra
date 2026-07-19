/**
 * @tundra/test-utils — fixtures and factories for tests and the API mock layer.
 *
 * Depends on `@tundra/domain` (and may use `@tundra/modules-sdk` contracts). Only
 * imported by tests and the dev/mock paths. Dates are fixed literal ISO strings —
 * never `Date.now()` — so fixtures are stable and snapshot-friendly.
 */

import {
	ExtensionPointKind,
	WorkItemPriority,
	WorkItemSource,
	WorkItemStatus,
} from "@tundra/domain";
import type {
	ModuleId,
	ModuleManifest,
	Project,
	ProjectId,
	UserId,
	Workspace,
	WorkspaceId,
	WorkItem,
	WorkItemId,
} from "@tundra/domain";

/** Stable timestamp used across fixtures. */
const FIXED_AT = "2026-06-01T00:00:00.000Z";

/** A canonical assignee used to exercise "My Tasks" aggregation. */
export const ADA: UserId = "user-ada" as UserId;
/** A second user so fixtures can prove assignee filtering. */
export const BOB: UserId = "user-bob" as UserId;

export const sampleWorkspace: Workspace = {
	id: "ws-tundra" as WorkspaceId,
	name: "Tundra HQ",
	slug: "tundra-hq",
	ownerId: ADA,
	enabledModuleIds: ["mod-helpdesk" as ModuleId],
	createdAt: FIXED_AT,
	updatedAt: FIXED_AT,
};

export const sampleProjects: Project[] = [
	{
		id: "proj-core" as ProjectId,
		workspaceId: sampleWorkspace.id,
		name: "Tundra Core",
		key: "TUN",
		slug: "tundra-core",
		description: "The core platform.",
		enabledModuleIds: ["mod-helpdesk" as ModuleId],
		createdAt: FIXED_AT,
		updatedAt: FIXED_AT,
	},
	{
		id: "proj-web" as ProjectId,
		workspaceId: sampleWorkspace.id,
		name: "Web App",
		key: "WEB",
		slug: "web-app",
		enabledModuleIds: [],
		createdAt: FIXED_AT,
		updatedAt: FIXED_AT,
	},
	{
		id: "proj-docs" as ProjectId,
		workspaceId: sampleWorkspace.id,
		name: "Docs",
		key: "DOC",
		slug: "docs",
		enabledModuleIds: [],
		createdAt: FIXED_AT,
		updatedAt: FIXED_AT,
	},
];

export const sampleModules: ModuleManifest[] = [
	{
		id: "mod-helpdesk" as ModuleId,
		name: "Helpdesk",
		version: "1.0.0",
		description: "Surfaces helpdesk tickets as WorkItems via a provider.",
		author: "Tundra",
		permissions: ["workitem:read", "project:nav"],
		providesWorkItemSources: [WorkItemSource.Extension],
		contributes: [
			{
				kind: ExtensionPointKind.NavEntry,
				surface: "frontend",
				slot: "project.nav",
			},
			{
				kind: ExtensionPointKind.WorkItemProvider,
				surface: "backend",
				slot: "workitem.providers",
			},
		],
	},
	{
		id: "mod-reviews" as ModuleId,
		name: "Code Reviews",
		version: "0.3.0",
		description: "Surfaces open code reviews as WorkItems.",
		author: "Tundra",
		permissions: ["workitem:read"],
		providesWorkItemSources: [WorkItemSource.Review],
		contributes: [
			{
				kind: ExtensionPointKind.WorkItemProvider,
				surface: "backend",
				slot: "workitem.providers",
			},
		],
	},
];

const coreProjectId = sampleProjects[0]!.id;

/**
 * Build a WorkItem with sensible, valid defaults. Override any field; the
 * `sourceRef` defaults to mirror `source`/`id` unless explicitly provided.
 */
export function makeWorkItem(overrides: Partial<WorkItem> = {}): WorkItem {
	const id = overrides.id ?? ("wi-sample" as WorkItemId);
	const source = overrides.source ?? WorkItemSource.Task;
	return {
		id,
		projectId: coreProjectId,
		source,
		sourceRef: { source, refId: String(id) },
		title: "Sample work item",
		status: WorkItemStatus.Todo,
		priority: WorkItemPriority.Medium,
		assigneeId: ADA,
		createdAt: FIXED_AT,
		updatedAt: FIXED_AT,
		...overrides,
	};
}

/**
 * A spread of WorkItems covering all eight `WorkItemSource` values. Most are
 * assigned to ADA (so `selectMyTasks(items, { assigneeId: ADA })` returns a
 * mixed-source set); a few use other assignees/statuses to exercise filtering.
 */
export const sampleWorkItems: WorkItem[] = [
	makeWorkItem({
		id: "wi-task-1" as WorkItemId,
		source: WorkItemSource.Task,
		title: "Implement login form",
		status: WorkItemStatus.InProgress,
		priority: WorkItemPriority.High,
	}),
	makeWorkItem({
		id: "wi-checklist-1" as WorkItemId,
		source: WorkItemSource.StoryChecklist,
		title: "Acceptance: empty-state copy reviewed",
		status: WorkItemStatus.Todo,
	}),
	makeWorkItem({
		id: "wi-subtask-1" as WorkItemId,
		source: WorkItemSource.Subtask,
		title: "Add password strength meter",
		status: WorkItemStatus.Todo,
	}),
	makeWorkItem({
		id: "wi-bug-1" as WorkItemId,
		source: WorkItemSource.Bug,
		title: "Fix 500 on expired token",
		status: WorkItemStatus.Blocked,
		priority: WorkItemPriority.Urgent,
	}),
	makeWorkItem({
		id: "wi-review-1" as WorkItemId,
		source: WorkItemSource.Review,
		title: "Review PR #42",
		status: WorkItemStatus.Todo,
		sourceRef: {
			source: WorkItemSource.Review,
			refId: "pr-42",
			moduleId: "mod-reviews" as ModuleId,
		},
	}),
	makeWorkItem({
		id: "wi-docs-1" as WorkItemId,
		source: WorkItemSource.Docs,
		title: "Update: authentication guide",
		status: WorkItemStatus.Todo,
	}),
	makeWorkItem({
		id: "wi-automation-1" as WorkItemId,
		source: WorkItemSource.Automation,
		title: "Auto: triage stale tickets",
		status: WorkItemStatus.Todo,
	}),
	makeWorkItem({
		id: "wi-extension-1" as WorkItemId,
		source: WorkItemSource.Extension,
		title: "Helpdesk ticket: cannot reset password",
		status: WorkItemStatus.InProgress,
		priority: WorkItemPriority.High,
		sourceRef: {
			source: WorkItemSource.Extension,
			refId: "ticket-1001",
			moduleId: "mod-helpdesk" as ModuleId,
		},
	}),
	// Assigned to BOB — should not appear in ADA's My Tasks.
	makeWorkItem({
		id: "wi-task-bob" as WorkItemId,
		source: WorkItemSource.Task,
		title: "Bob's task",
		assigneeId: BOB,
	}),
	// Terminal status — excluded from My Tasks by default.
	makeWorkItem({
		id: "wi-task-done" as WorkItemId,
		source: WorkItemSource.Task,
		title: "Already shipped",
		status: WorkItemStatus.Done,
	}),
	// In a different project — exercises projectId narrowing.
	makeWorkItem({
		id: "wi-task-web" as WorkItemId,
		source: WorkItemSource.Task,
		title: "Web app task",
		projectId: sampleProjects[1]!.id,
	}),
];
