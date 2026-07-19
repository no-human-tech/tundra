/**
 * Kanban board fixtures for the Aurora Platform (`proj-core`) project board.
 *
 * Columns: Backlog · Ready · In Progress · Review · Done. Cards carry priority,
 * assignee, estimate (points), labels, comments and a blocked flag (drives the
 * orange left-bar + BLOCKED badge). Phase 2b renders these via KanbanColumn /
 * KanbanCard.
 */

import { WorkItemPriority } from "@tundra/domain";
import type { KanbanCardData } from "@tundra/ui";

import { PEOPLE } from "./people.js";

export type BoardColumnName = "Backlog" | "Ready" | "In Progress" | "Review" | "Done";

export const BOARD_COLUMN_ORDER: BoardColumnName[] = [
	"Backlog",
	"Ready",
	"In Progress",
	"Review",
	"Done",
];

/** Accent color (CSS) per column header dot, keyed by column name. */
export const BOARD_COLUMN_ACCENT: Record<BoardColumnName, string> = {
	Backlog: "var(--tnd-color-text-subtle)",
	Ready: "var(--tnd-color-info)",
	"In Progress": "var(--tnd-color-brand)",
	Review: "var(--tnd-color-warning)",
	Done: "var(--tnd-color-success)",
};

export interface BoardLabel {
	name: string;
}

export interface BoardCard extends KanbanCardData {
	column: BoardColumnName;
	/** display labels for the card */
	boardLabels: BoardLabel[];
}

export const BOARD_CARDS: BoardCard[] = [
	{
		id: "AUR-142",
		reference: "AUR-142",
		title: "Auth: refresh-token rotation",
		column: "Backlog",
		priority: WorkItemPriority.Medium,
		points: 5,
		assigneeName: PEOPLE.aleks.name,
		comments: 2,
		boardLabels: [{ name: "backend" }],
	},
	{
		id: "AUR-150",
		reference: "AUR-150",
		title: "Empty states for module gallery",
		column: "Backlog",
		priority: WorkItemPriority.Low,
		points: 2,
		assigneeName: PEOPLE.sena.name,
		comments: 0,
		boardLabels: [{ name: "design" }],
	},
	{
		id: "AUR-128",
		reference: "AUR-128",
		title: "Drag-and-drop across swimlanes",
		column: "Ready",
		priority: WorkItemPriority.High,
		points: 8,
		assigneeName: PEOPLE.mira.name,
		comments: 5,
		boardLabels: [{ name: "frontend" }, { name: "board" }],
	},
	{
		id: "AUR-131",
		reference: "AUR-131",
		title: "Module manifest schema v2",
		column: "Ready",
		priority: WorkItemPriority.High,
		points: 5,
		assigneeName: PEOPLE.priya.name,
		comments: 3,
		boardLabels: [{ name: "sdk" }],
	},
	{
		id: "AUR-119",
		reference: "AUR-119",
		title: "Extension point: task drawer slots",
		column: "In Progress",
		priority: WorkItemPriority.Urgent,
		points: 8,
		blocked: true,
		assigneeName: PEOPLE.mira.name,
		comments: 8,
		boardLabels: [{ name: "core" }, { name: "sdk" }],
	},
	{
		id: "AUR-124",
		reference: "AUR-124",
		title: "Time tracking timer widget",
		column: "In Progress",
		priority: WorkItemPriority.Medium,
		points: 3,
		assigneeName: PEOPLE.jonas.name,
		comments: 1,
		boardLabels: [{ name: "time" }],
	},
	{
		id: "AUR-108",
		reference: "AUR-108",
		title: "GraphQL gateway for modules",
		column: "Review",
		priority: WorkItemPriority.High,
		points: 13,
		assigneeName: PEOPLE.aleks.name,
		comments: 4,
		boardLabels: [{ name: "backend" }, { name: "api" }],
	},
	{
		id: "AUR-117",
		reference: "AUR-117",
		title: "Docs ↔ task linking",
		column: "Review",
		priority: WorkItemPriority.Medium,
		points: 5,
		assigneeName: PEOPLE.sena.name,
		comments: 2,
		boardLabels: [{ name: "docs" }],
	},
	{
		id: "AUR-099",
		reference: "AUR-099",
		title: "Sidebar nav + keyboard a11y",
		column: "Done",
		priority: WorkItemPriority.Medium,
		points: 3,
		assigneeName: PEOPLE.mira.name,
		comments: 6,
		boardLabels: [{ name: "a11y" }],
	},
	{
		id: "AUR-101",
		reference: "AUR-101",
		title: "Project module toggles",
		column: "Done",
		priority: WorkItemPriority.High,
		points: 5,
		assigneeName: PEOPLE.priya.name,
		comments: 2,
		boardLabels: [{ name: "settings" }],
	},
	{
		id: "AUR-095",
		reference: "AUR-095",
		title: "Notification badge service",
		column: "Done",
		priority: WorkItemPriority.Low,
		points: 2,
		assigneeName: PEOPLE.jonas.name,
		comments: 0,
		boardLabels: [{ name: "backend" }],
	},
];

export interface BoardColumn {
	name: BoardColumnName;
	accent: string;
	cards: BoardCard[];
}

export const boardColumns: BoardColumn[] = BOARD_COLUMN_ORDER.map((name) => ({
	name,
	accent: BOARD_COLUMN_ACCENT[name],
	cards: BOARD_CARDS.filter((c) => c.column === name),
}));

export function findBoardCard(id: string): BoardCard | undefined {
	return BOARD_CARDS.find((c) => c.id === id);
}
