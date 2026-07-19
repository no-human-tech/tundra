/**
 * Unified WorkItem fixtures for the My Tasks queue and the dashboard "My work
 * queue" widget.
 *
 * Every source (task, story checklist, subtask, bug, review, docs, automation,
 * extension) is one `WorkItemView`, rendered by the SAME `WorkItemRow`. Source is
 * metadata (a badge), never a separate layout.
 *
 * Two exports:
 *  - `sampleMyTasks`: the original mixed-source array (one of each of six sources)
 *    that the unit tests + e2e assert against (kept stable).
 *  - `myTasksGroups`: the full grouped queue (Today / Upcoming / Blocked /
 *    No due date / Done recently) built from WorkItemViews covering all sources.
 *
 * Status uses the canonical `@tundra/domain` enum string values (status is
 * `todo`, not `open`). Demo-only; the real app resolves these via `selectMyTasks`.
 */

import { WorkItemPriority, WorkItemSource, WorkItemStatus } from "@tundra/domain";
import type { WorkItemView } from "@tundra/ui";

import { ME } from "./people.js";

/**
 * The grouping buckets in queue order. `Done recently` is dimmed/collapsible.
 */
export type MyTasksGroupName = "Today" | "Upcoming" | "Blocked" | "No due date" | "Done recently";

export const MY_TASKS_GROUP_ORDER: MyTasksGroupName[] = [
	"Today",
	"Upcoming",
	"Blocked",
	"No due date",
	"Done recently",
];

export const MY_TASKS_GROUP_HINT: Record<MyTasksGroupName, string> = {
	Today: "Due today",
	Upcoming: "This week & later",
	Blocked: "Needs unblocking",
	"No due date": "Unscheduled",
	"Done recently": "Completed",
};

/**
 * A My Tasks queue entry: a display-ready WorkItemView plus queue metadata (the
 * group it belongs to, the parent work item it came from, and an optional story
 * id so a story-checklist item can open the parent story's checklist drawer).
 */
export interface MyTaskEntry {
	item: WorkItemView;
	group: MyTasksGroupName;
	/** the parent source, e.g. "User Story: Team onboarding" / "Task AUR-214" */
	parent: string;
	/** estimate label, e.g. "3 pts" */
	estimate?: string;
	comments?: number;
	/** present for story-checklist items: the parent story to open in the drawer */
	storyId?: string;
}

const ASSIGNEE = { id: ME.id, name: ME.name };

export const myTasksEntries: MyTaskEntry[] = [
	// ---- Today ----
	{
		item: {
			id: "wi-w1",
			source: WorkItemSource.StoryChecklist,
			title: "Prepare API contract",
			status: WorkItemStatus.InProgress,
			priority: WorkItemPriority.High,
			projectKey: "AUR",
			projectName: "Aurora Platform",
			reference: "AUR-201-1",
			dueAt: "2026-06-27",
			assignee: ASSIGNEE,
		},
		group: "Today",
		parent: "User Story: Team onboarding",
		estimate: "3 pts",
		comments: 2,
		storyId: "story-onboarding",
	},
	{
		item: {
			id: "wi-w2",
			source: WorkItemSource.Task,
			title: "Fix login redirect after expired session",
			status: WorkItemStatus.Todo,
			priority: WorkItemPriority.Medium,
			projectKey: "AUR",
			projectName: "Aurora Platform",
			reference: "AUR-214",
			dueAt: "2026-06-27",
			assignee: ASSIGNEE,
		},
		group: "Today",
		parent: "Task AUR-214",
		estimate: "2 pts",
	},
	{
		item: {
			id: "wi-w4",
			source: WorkItemSource.Review,
			title: "Review module manifest v2",
			status: WorkItemStatus.Todo,
			priority: WorkItemPriority.High,
			projectKey: "AUR",
			projectName: "Aurora Platform",
			reference: "PR-284",
			dueAt: "2026-06-27",
			assignee: ASSIGNEE,
		},
		group: "Today",
		parent: "Pull Request #284",
		comments: 4,
	},

	// ---- Upcoming ----
	{
		item: {
			id: "wi-w3",
			source: WorkItemSource.StoryChecklist,
			title: "Add empty state copy for module gallery",
			status: WorkItemStatus.Todo,
			priority: WorkItemPriority.Low,
			projectKey: "OSS",
			projectName: "Tundra OSS",
			reference: "OSS-44-2",
			dueAt: "2026-06-28",
			assignee: ASSIGNEE,
		},
		group: "Upcoming",
		parent: "Story: Extension marketplace",
		storyId: "story-marketplace",
	},
	{
		item: {
			id: "wi-w5",
			source: WorkItemSource.Docs,
			title: "Document drawer extension slots",
			status: WorkItemStatus.InProgress,
			priority: WorkItemPriority.Medium,
			projectKey: "OSS",
			projectName: "Tundra OSS",
			reference: "OSS-DOC-7",
			dueAt: "2026-07-01",
			assignee: ASSIGNEE,
		},
		group: "Upcoming",
		parent: "Docs: Extension SDK",
	},
	{
		item: {
			id: "wi-w8",
			source: WorkItemSource.Automation,
			title: "Approve sprint scope changes",
			status: WorkItemStatus.Todo,
			priority: WorkItemPriority.Medium,
			projectKey: "AUR",
			projectName: "Aurora Platform",
			reference: "AUTO-24",
			dueAt: "2026-06-28",
			moduleLabel: "Automations",
			assignee: ASSIGNEE,
		},
		group: "Upcoming",
		parent: "Sprint 24",
	},
	{
		item: {
			id: "wi-w12",
			source: WorkItemSource.Subtask,
			title: "Update sprint burndown widget",
			status: WorkItemStatus.Todo,
			priority: WorkItemPriority.Low,
			projectKey: "AUR",
			projectName: "Aurora Platform",
			reference: "AUR-198-1",
			dueAt: "2026-07-02",
			assignee: ASSIGNEE,
		},
		group: "Upcoming",
		parent: "Task AUR-198",
		estimate: "1 pt",
	},
	{
		item: {
			id: "wi-w10",
			source: WorkItemSource.Extension,
			title: "Validate GitHub integration permissions",
			status: WorkItemStatus.Todo,
			priority: WorkItemPriority.High,
			projectKey: "PRM",
			projectName: "Permafrost Infra",
			reference: "PRM-EXT-3",
			dueAt: "2026-07-03",
			moduleLabel: "GitHub",
			assignee: ASSIGNEE,
		},
		group: "Upcoming",
		parent: "Extension: GitHub Integration",
	},

	// ---- Blocked ----
	{
		item: {
			id: "wi-w6",
			source: WorkItemSource.Bug,
			title: "Investigate broken timer sync",
			status: WorkItemStatus.Blocked,
			priority: WorkItemPriority.Urgent,
			projectKey: "FRB",
			projectName: "Frostbyte API",
			reference: "FRB-88",
			dueAt: "2026-06-27",
			assignee: ASSIGNEE,
		},
		group: "Blocked",
		parent: "Bug FRB-88",
		comments: 3,
	},
	{
		item: {
			id: "wi-w11",
			source: WorkItemSource.Bug,
			title: "Unblock board drag performance regression",
			status: WorkItemStatus.Blocked,
			priority: WorkItemPriority.High,
			projectKey: "AUR",
			projectName: "Aurora Platform",
			reference: "AUR-221",
			dueAt: "2026-06-28",
			assignee: ASSIGNEE,
		},
		group: "Blocked",
		parent: "Bug AUR-221",
	},

	// ---- No due date ----
	{
		item: {
			id: "wi-w7",
			source: WorkItemSource.StoryChecklist,
			title: "Create onboarding checklist template",
			status: WorkItemStatus.Todo,
			priority: WorkItemPriority.Medium,
			projectKey: "GLC",
			projectName: "Glacier Docs",
			reference: "GLC-12-1",
			assignee: ASSIGNEE,
		},
		group: "No due date",
		parent: "User Story: New maintainer onboarding",
		storyId: "story-maintainer",
	},

	// ---- Done recently ----
	{
		item: {
			id: "wi-d1",
			source: WorkItemSource.Task,
			title: "Sidebar nav + keyboard a11y",
			status: WorkItemStatus.Done,
			priority: WorkItemPriority.Medium,
			projectKey: "AUR",
			projectName: "Aurora Platform",
			reference: "AUR-099",
			assignee: ASSIGNEE,
		},
		group: "Done recently",
		parent: "Task AUR-099",
	},
	{
		item: {
			id: "wi-d2",
			source: WorkItemSource.Bug,
			title: "Triage incoming bug reports",
			status: WorkItemStatus.Done,
			priority: WorkItemPriority.Low,
			projectKey: "FRB",
			projectName: "Frostbyte API",
			reference: "FRB-71",
			assignee: ASSIGNEE,
		},
		group: "Done recently",
		parent: "Bug FRB-71",
	},
];

export interface MyTasksGroup {
	name: MyTasksGroupName;
	hint: string;
	entries: MyTaskEntry[];
}

/**
 * Bucket a flat list of queue entries into the canonical groups, in queue order,
 * dropping empty groups. Shared by the demo fixtures below AND by the live API
 * path (which builds `MyTaskEntry`s from GraphQL `WorkItem`s and groups them with
 * the same rules), so demo and live render through an identical structure.
 */
export function groupMyTaskEntries(entries: MyTaskEntry[]): MyTasksGroup[] {
	return MY_TASKS_GROUP_ORDER.map((name) => ({
		name,
		hint: MY_TASKS_GROUP_HINT[name],
		entries: entries.filter((e) => e.group === name),
	})).filter((g) => g.entries.length > 0);
}

/**
 * Assign a queue group to a work item from its status + due date, relative to a
 * reference "today" (ISO `YYYY-MM-DD`). Mirrors the demo grouping so the live API
 * queue buckets the same way: Done/Cancelled -> Done recently; Blocked ->
 * Blocked; no due date -> No due date; due on/before today -> Today; otherwise
 * Upcoming.
 */
export function groupForWorkItem(
	status: WorkItemStatus,
	dueAt: string | undefined,
	today: string,
): MyTasksGroupName {
	if (status === WorkItemStatus.Done || status === WorkItemStatus.Cancelled) {
		return "Done recently";
	}
	if (status === WorkItemStatus.Blocked) return "Blocked";
	if (!dueAt) return "No due date";
	return dueAt.slice(0, 10) <= today ? "Today" : "Upcoming";
}

/** The grouped My Tasks queue, in queue order, empty groups omitted. */
export const myTasksGroups: MyTasksGroup[] = groupMyTaskEntries(myTasksEntries);

/** Lookup a queue entry by its work-item id (for the drawer). */
export function findMyTaskEntry(id: string): MyTaskEntry | undefined {
	return myTasksEntries.find((e) => e.item.id === id);
}

/**
 * The original mixed-source My Tasks array. One item per source for six of the
 * sources (task, story_checklist, bug, review, docs, extension), preserved as the
 * stable contract the unit tests + e2e assert against. Also used as the dashboard
 * "My work queue" preview.
 */
export const sampleMyTasks: WorkItemView[] = [
	{
		id: "wi-1",
		source: WorkItemSource.Task,
		title: "Fix login redirect after expired session",
		status: WorkItemStatus.InProgress,
		priority: WorkItemPriority.High,
		projectKey: "AUR",
		projectName: "Aurora Platform",
		reference: "AUR-214",
		dueAt: "2026-06-29",
		assignee: ASSIGNEE,
	},
	{
		id: "wi-2",
		source: WorkItemSource.StoryChecklist,
		title: "Prepare API contract",
		status: WorkItemStatus.Todo,
		priority: WorkItemPriority.Medium,
		projectKey: "AUR",
		projectName: "Aurora Platform",
		reference: "AUR-201-1",
		assignee: ASSIGNEE,
	},
	{
		id: "wi-3",
		source: WorkItemSource.Bug,
		title: "Investigate broken timer sync",
		status: WorkItemStatus.Blocked,
		priority: WorkItemPriority.Urgent,
		projectKey: "FRB",
		projectName: "Frostbyte API",
		reference: "FRB-88",
		dueAt: "2026-06-28",
		assignee: ASSIGNEE,
	},
	{
		id: "wi-4",
		source: WorkItemSource.Review,
		title: "Review module manifest v2",
		status: WorkItemStatus.Todo,
		priority: WorkItemPriority.High,
		projectKey: "AUR",
		projectName: "Aurora Platform",
		reference: "PR-284",
		assignee: ASSIGNEE,
	},
	{
		id: "wi-5",
		source: WorkItemSource.Docs,
		title: "Document drawer extension slots",
		status: WorkItemStatus.InProgress,
		priority: WorkItemPriority.Low,
		projectKey: "OSS",
		projectName: "Tundra OSS",
		reference: "OSS-DOC-7",
		assignee: ASSIGNEE,
	},
	{
		id: "wi-6",
		source: WorkItemSource.Extension,
		title: "Validate GitHub integration permissions",
		status: WorkItemStatus.Todo,
		priority: WorkItemPriority.Medium,
		projectKey: "PRM",
		projectName: "Permafrost Infra",
		reference: "PRM-EXT-3",
		moduleLabel: "GitHub",
		assignee: ASSIGNEE,
	},
];

/** The dashboard "My work queue" widget preview (a few mixed-source items). */
export const dashboardWorkQueue: WorkItemView[] = [
	myTasksEntries[1]!.item, // task
	myTasksEntries[0]!.item, // story checklist
	myTasksEntries[2]!.item, // review
	myTasksEntries[8]!.item, // bug (blocked)
];
