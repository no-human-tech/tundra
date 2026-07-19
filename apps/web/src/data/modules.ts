/**
 * Modules catalog + extension points fixtures.
 *
 * Tundra is a modular workspace: a project enables/disables modules, and modules
 * register against named extension points. These fixtures drive the Extensions
 * marketplace, the Workspace/Project settings module registries, and the project
 * context-bar pills. Demo-only.
 */

import type { ModuleStatus } from "@tundra/ui";
import type { IconName } from "@tundra/ui";

export interface ModuleCatalogEntry {
	id: string;
	name: string;
	/** category, e.g. "Workflow" / "Core" / "Integration" */
	category: string;
	/** semantic version string, e.g. "2.4.0" */
	version: string;
	status: ModuleStatus;
	description: string;
	/** icon name for the module tile */
	icon: IconName;
	/** required Core module: cannot be disabled */
	locked?: boolean;
}

/**
 * The full module catalog shown in the Extensions marketplace (Tasks Core,
 * Kanban Board, Backlog, Sprints, Time Tracking, Docs, Reports, GitHub
 * Integration, Community Import, Custom Module SDK, plus Roadmap and
 * Automations). Discussions was withdrawn (the design spec §6) — threaded
 * conversation now lives in comments on tasks/stories/docs; "Community
 * Import" mirrors posts from an external forum into that same in-app
 * Comments module, and is named to avoid any ambiguity with the withdrawn
 * module or the third-party product it happens to integrate with.
 */
export const MODULE_CATALOG: ModuleCatalogEntry[] = [
	{
		id: "mod-tasks",
		name: "Tasks Core",
		category: "Core",
		version: "2.4.0",
		status: "Installed",
		description: "Issues, subtasks, estimates and the data model every other module builds on.",
		icon: "checkSquare",
		locked: true,
	},
	{
		id: "mod-board",
		name: "Kanban Board",
		category: "Workflow",
		version: "2.4.0",
		status: "Enabled",
		description: "Drag-and-drop board with columns, swimlanes and WIP limits.",
		icon: "columns",
	},
	{
		id: "mod-backlog",
		name: "Backlog",
		category: "Workflow",
		version: "1.9.2",
		status: "Enabled",
		description: "Ordered backlog with bulk triage and sprint planning hand-off.",
		icon: "list",
	},
	{
		id: "mod-sprints",
		name: "Sprints",
		category: "Workflow",
		version: "1.9.2",
		status: "Enabled",
		description: "Timeboxes, burndown and capacity, wired into Reports.",
		icon: "sprints",
	},
	{
		id: "mod-time",
		name: "Time Tracking",
		category: "Productivity",
		version: "1.3.0",
		status: "Enabled",
		description: "Timers and weekly timesheets linked to tasks and projects.",
		icon: "clock",
	},
	{
		id: "mod-docs",
		name: "Docs",
		category: "Knowledge",
		version: "1.7.1",
		status: "Enabled",
		description: "Markdown wiki with a page tree and two-way task links.",
		icon: "docs",
	},
	{
		id: "mod-reports",
		name: "Reports",
		category: "Insight",
		version: "1.5.0",
		status: "Enabled",
		description: "Velocity, throughput and time dashboards across modules.",
		icon: "bars",
	},
	{
		id: "mod-roadmap",
		name: "Roadmap",
		category: "Planning",
		version: "0.8.0",
		status: "Disabled",
		description: "Timeline of epics and milestones across projects.",
		icon: "roadmap",
	},
	{
		id: "mod-github",
		name: "GitHub Integration",
		category: "Integration",
		version: "2.0.1",
		status: "Installed",
		description: "Sync issues, link PRs and automate status from commits.",
		icon: "github",
	},
	{
		// Named "Community Import" (not the external product's own name) so the
		// catalog never shows a string that could be mistaken for a reintroduced
		// Discussions module: this mirrors posts FROM an external community forum
		// INTO the project's own Comments module; it does not add a second in-app
		// conversation surface.
		id: "mod-community-import",
		name: "Community Import",
		category: "Integration",
		version: "0.6.2",
		status: "Disabled",
		description: "Mirror posts from an external community forum into project comments.",
		icon: "message",
	},
	{
		id: "mod-automations",
		name: "Automations",
		category: "Workflow",
		version: "0.3.0",
		status: "Experimental",
		description: "When/then rules that move work and notify across modules.",
		icon: "bolt",
	},
	{
		id: "mod-sdk",
		name: "Custom Module SDK",
		category: "Developer",
		version: "0.3.0",
		status: "Experimental",
		description: "Scaffold, register and ship your own modules and extension panels.",
		icon: "terminal",
	},
];

export function findModule(id: string): ModuleCatalogEntry | undefined {
	return MODULE_CATALOG.find((m) => m.id === id);
}

/** A named slot modules register against. The 6 first-class extension points. */
export interface ExtensionPointEntry {
	id: string;
	name: string;
	/** manifest slot id, e.g. "sidebar" */
	slotId: string;
	description: string;
	/** number of modules currently contributing */
	contributing: number;
	icon: IconName;
}

export const EXTENSION_POINTS: ExtensionPointEntry[] = [
	{
		id: "ext-sidebar",
		name: "Sidebar",
		slotId: "nav.entry",
		description: "Nav entries & workspace sections.",
		contributing: 4,
		icon: "dashboard",
	},
	{
		id: "ext-tabs",
		name: "Project tabs",
		slotId: "project.tab",
		description: "Top-level module views per project.",
		contributing: 8,
		icon: "columns",
	},
	{
		id: "ext-drawer",
		name: "Task drawer",
		slotId: "task.drawer.panel",
		description: "Extra panels on any task.",
		contributing: 5,
		icon: "checkSquare",
	},
	{
		id: "ext-widgets",
		name: "Dashboard widgets",
		slotId: "dashboard.widget",
		description: "Cards on workspace & project home.",
		contributing: 6,
		icon: "bars",
	},
	{
		id: "ext-automation",
		name: "Automation actions",
		slotId: "automation.action",
		description: "When/then triggers & effects.",
		contributing: 12,
		icon: "bolt",
	},
	{
		id: "ext-reports",
		name: "Reports",
		slotId: "report.kind",
		description: "Metrics & chart contributions.",
		contributing: 3,
		icon: "review",
	},
];
