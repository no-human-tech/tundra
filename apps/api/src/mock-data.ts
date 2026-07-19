/**
 * In-memory mock data for the API.
 *
 * MOCK ONLY — the API does not connect to Postgres/Redis yet (this is the
 * scaffolding phase). These fixtures mirror `@tundra/test-utils` but are defined
 * locally because `apps/api` does not declare a dependency on `@tundra/test-utils`
 * (that package is test-scoped). All ids/dates are fixed literals so responses
 * are deterministic.
 *
 * When real persistence lands, resolvers swap these arrays for `@tundra/db`
 * repositories with no change to the GraphQL contract.
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
	WorkItem,
	WorkItemId,
	WorkspaceId,
} from "@tundra/domain";

const FIXED_AT = "2026-06-01T00:00:00.000Z";

export const MOCK_WORKSPACE_ID: WorkspaceId = "ws-tundra" as WorkspaceId;
export const ADA: UserId = "user-ada" as UserId;
export const BOB: UserId = "user-bob" as UserId;

/** Display names for the seeded dev users, mirroring `@tundra/db`'s seedDev. */
export const mockUserDisplayNames: Readonly<Record<string, string>> = {
	[ADA]: "Ada Lovelace",
	[BOB]: "Bob Martin",
};

const CORE: ProjectId = "proj-core" as ProjectId;
const WEB: ProjectId = "proj-web" as ProjectId;

export const mockProjects: Project[] = [
	{
		id: CORE,
		workspaceId: MOCK_WORKSPACE_ID,
		name: "Tundra Core",
		key: "TUN",
		slug: "tundra-core",
		description: "The core platform.",
		enabledModuleIds: ["mod-helpdesk" as ModuleId],
		createdAt: FIXED_AT,
		updatedAt: FIXED_AT,
	},
	{
		id: WEB,
		workspaceId: MOCK_WORKSPACE_ID,
		name: "Web App",
		key: "WEB",
		slug: "web-app",
		enabledModuleIds: [],
		createdAt: FIXED_AT,
		updatedAt: FIXED_AT,
	},
];

export const mockModules: ModuleManifest[] = [
	{
		id: "mod-helpdesk" as ModuleId,
		name: "Helpdesk",
		version: "1.0.0",
		description: "Surfaces helpdesk tickets as WorkItems via a provider.",
		author: "Tundra",
		permissions: ["workitem:read", "project:nav"],
		providesWorkItemSources: [WorkItemSource.Extension],
		contributes: [
			{ kind: ExtensionPointKind.NavEntry, surface: "frontend", slot: "project.nav" },
			{ kind: ExtensionPointKind.WorkItemProvider, surface: "backend", slot: "workitem.providers" },
		],
	},
];

function wi(over: Partial<WorkItem> & Pick<WorkItem, "id" | "source" | "title">): WorkItem {
	return {
		projectId: CORE,
		sourceRef: { source: over.source, refId: String(over.id) },
		status: WorkItemStatus.Todo,
		priority: WorkItemPriority.Medium,
		assigneeId: ADA,
		createdAt: FIXED_AT,
		updatedAt: FIXED_AT,
		...over,
	};
}

/** WorkItems covering all eight sources; most assigned to ADA for My Tasks. */
export const mockWorkItems: WorkItem[] = [
	wi({
		id: "wi-task-1" as WorkItemId,
		source: WorkItemSource.Task,
		title: "Implement login form",
		status: WorkItemStatus.InProgress,
		priority: WorkItemPriority.High,
	}),
	wi({
		id: "wi-checklist-1" as WorkItemId,
		source: WorkItemSource.StoryChecklist,
		title: "Acceptance: empty-state copy reviewed",
	}),
	wi({
		id: "wi-subtask-1" as WorkItemId,
		source: WorkItemSource.Subtask,
		title: "Add password strength meter",
	}),
	wi({
		id: "wi-bug-1" as WorkItemId,
		source: WorkItemSource.Bug,
		title: "Fix 500 on expired token",
		status: WorkItemStatus.Blocked,
		priority: WorkItemPriority.Urgent,
	}),
	wi({
		id: "wi-review-1" as WorkItemId,
		source: WorkItemSource.Review,
		title: "Review PR #42",
		sourceRef: {
			source: WorkItemSource.Review,
			refId: "pr-42",
			moduleId: "mod-reviews" as ModuleId,
		},
	}),
	wi({
		id: "wi-docs-1" as WorkItemId,
		source: WorkItemSource.Docs,
		title: "Update: authentication guide",
	}),
	wi({
		id: "wi-automation-1" as WorkItemId,
		source: WorkItemSource.Automation,
		title: "Auto: triage stale tickets",
	}),
	wi({
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
	// Other users / terminal statuses for filter coverage.
	wi({
		id: "wi-task-bob" as WorkItemId,
		source: WorkItemSource.Task,
		title: "Bob's task",
		assigneeId: BOB,
	}),
	wi({
		id: "wi-task-done" as WorkItemId,
		source: WorkItemSource.Task,
		title: "Already shipped",
		status: WorkItemStatus.Done,
	}),
	wi({
		id: "wi-task-web" as WorkItemId,
		source: WorkItemSource.Task,
		title: "Web app task",
		projectId: WEB,
	}),
];
