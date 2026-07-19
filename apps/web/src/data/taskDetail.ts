/**
 * Task-detail fixtures for the project Board's task drawer (Phase 2b).
 *
 * The board fixtures (`BOARD_CARDS`) carry the card-face data (priority, points,
 * assignee, labels, comments, blocked). The drawer needs richer per-task detail —
 * time spent, a checklist, an activity log, links, and the automation rules a
 * module contributes. That detail is genuinely missing from the existing data
 * layer, so this NEW file adds it without changing any existing fixture. Demo-only.
 *
 * `getTaskDetail(cardId)` always returns a detail object: cards with bespoke
 * entries get them; everything else falls back to a sensible generic detail so the
 * drawer is never empty.
 */

import { PEOPLE, type Person } from "./people.js";

export interface TaskChecklistItem {
	id: string;
	text: string;
	done: boolean;
	assignee: Person;
	/** true when assigned to the signed-in user (highlighted, "Appears in My Tasks") */
	isMine?: boolean;
}

export interface TaskActivityEntry {
	id: string;
	who: string;
	action: string;
	/** mono relative time, e.g. "2h" */
	when: string;
}

export interface TaskComment {
	id: string;
	author: Person;
	when: string;
	text: string;
}

export interface TaskLink {
	id: string;
	/** kind label, e.g. "Blocks" / "Doc" / "Pull request" */
	kind: string;
	/** the linked reference/title */
	label: string;
}

export interface TaskAutomationRule {
	id: string;
	/** trigger summary, e.g. "When moved to Review" */
	when: string;
	/** effect summary, e.g. "Request review from code owners" */
	then: string;
}

export interface TaskDetail {
	/** hours logged on this task */
	timeSpentHours: number;
	/** estimate label echoed in the Time tab */
	estimateHours: number;
	checklist: TaskChecklistItem[];
	activity: TaskActivityEntry[];
	comments: TaskComment[];
	links: TaskLink[];
	automation: TaskAutomationRule[];
	/** module-contributed panels available on this task (drawer strip) */
	modulePanels: string[];
}

const GENERIC_DETAIL: TaskDetail = {
	timeSpentHours: 3.5,
	estimateHours: 5,
	checklist: [
		{ id: "gc-1", text: "Write the implementation", done: true, assignee: PEOPLE.aleks },
		{ id: "gc-2", text: "Add unit tests", done: false, assignee: PEOPLE.jonas },
		{ id: "gc-3", text: "Update the docs", done: false, assignee: PEOPLE.sena },
	],
	activity: [
		{ id: "ga-1", who: "Aleks", action: "created the task", when: "3d" },
		{ id: "ga-2", who: "Mira", action: "set the estimate to 5 pts", when: "2d" },
		{ id: "ga-3", who: "Jonas", action: "moved it forward a column", when: "5h" },
	],
	comments: [
		{
			id: "gco-1",
			author: PEOPLE.aleks,
			when: "2h",
			text: "Picking this up — will open a draft PR shortly.",
		},
	],
	links: [
		{ id: "gl-1", kind: "Doc", label: "Module system" },
		{ id: "gl-2", kind: "Comment", label: "RFC: module manifest v2" },
	],
	automation: [
		{ id: "gauto-1", when: "When moved to Review", then: "Request review from code owners" },
		{ id: "gauto-2", when: "When marked Done", then: "Log remaining time and close linked PR" },
	],
	modulePanels: ["Time", "Docs"],
};

/** Bespoke detail for a few headline cards (richer demo content). */
const TASK_DETAILS: Record<string, TaskDetail> = {
	"AUR-119": {
		timeSpentHours: 6.25,
		estimateHours: 8,
		checklist: [
			{
				id: "c119-1",
				text: "Define the slot manifest type",
				done: true,
				assignee: PEOPLE.mira,
				isMine: true,
			},
			{
				id: "c119-2",
				text: "Render registered panels in the drawer",
				done: true,
				assignee: PEOPLE.mira,
				isMine: true,
			},
			{
				id: "c119-3",
				text: "Fallback when a module is disabled",
				done: false,
				assignee: PEOPLE.priya,
			},
			{
				id: "c119-4",
				text: "Document the task.drawer.panel slot",
				done: false,
				assignee: PEOPLE.sena,
			},
		],
		activity: [
			{ id: "a119-1", who: "Mira", action: "created the task", when: "6d" },
			{ id: "a119-2", who: "Aleks", action: "flagged it blocked on manifest v2", when: "2d" },
			{ id: "a119-3", who: "Mira", action: "logged 2.5h", when: "5h" },
			{ id: "a119-4", who: "Priya", action: "commented", when: "3h" },
		],
		comments: [
			{
				id: "co119-1",
				author: PEOPLE.priya,
				when: "3h",
				text: "Blocked until the manifest v2 schema lands — the slot ids change.",
			},
			{
				id: "co119-2",
				author: PEOPLE.mira,
				when: "2h",
				text: "Agreed. Tracking that in AUR-131; I'll keep the panel-render side moving.",
			},
		],
		links: [
			{ id: "l119-1", kind: "Blocked by", label: "AUR-131 · Module manifest schema v2" },
			{ id: "l119-2", kind: "Doc", label: "Extension points" },
			{ id: "l119-3", kind: "Pull request", label: "PR-284 · Drawer slot host" },
		],
		automation: [
			{ id: "auto119-1", when: "When moved to Review", then: "Request review from the SDK owners" },
			{ id: "auto119-2", when: "When a linked PR merges", then: "Move to Done and stop the timer" },
		],
		modulePanels: ["Time", "Docs", "GitHub"],
	},
	"AUR-108": {
		timeSpentHours: 9,
		estimateHours: 13,
		checklist: [
			{
				id: "c108-1",
				text: "Schema stitching for module subgraphs",
				done: true,
				assignee: PEOPLE.aleks,
			},
			{ id: "c108-2", text: "Auth context propagation", done: true, assignee: PEOPLE.aleks },
			{ id: "c108-3", text: "Rate limiting per module", done: false, assignee: PEOPLE.jonas },
		],
		activity: [
			{ id: "a108-1", who: "Aleks", action: "opened the PR", when: "1d" },
			{ id: "a108-2", who: "Mira", action: "requested changes", when: "6h" },
			{ id: "a108-3", who: "Aleks", action: "pushed a fixup", when: "1h" },
		],
		comments: [
			{
				id: "co108-1",
				author: PEOPLE.mira,
				when: "6h",
				text: "Looks great — one nit on the error mapping, otherwise ready to merge.",
			},
		],
		links: [
			{ id: "l108-1", kind: "Pull request", label: "PR-281 · GraphQL gateway" },
			{ id: "l108-2", kind: "Doc", label: "API reference" },
		],
		automation: [
			{ id: "auto108-1", when: "When approved", then: "Auto-merge and deploy to staging" },
		],
		modulePanels: ["Time", "GitHub"],
	},
};

/** Resolve the detail for a board card; falls back to a generic detail. */
export function getTaskDetail(cardId: string): TaskDetail {
	return TASK_DETAILS[cardId] ?? GENERIC_DETAIL;
}
