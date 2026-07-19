/**
 * Workspace dashboard fixtures: top metric cards, module activity, and recent
 * project activity. Demo-only.
 */

import type { IconName, MetricStatTone } from "@tundra/ui";

export interface DashboardMetric {
	id: string;
	label: string;
	value: string;
	/** small delta/context, e.g. "+1" / "3 due" */
	delta: string;
	/** secondary line under the metric */
	sub: string;
	icon: IconName;
	tone: MetricStatTone;
	/** true when the delta should read as an accent (orange) signal */
	deltaAccent?: boolean;
	/** numeric value to interpolate into the translated delta (e.g. `{{count}} due today`) */
	deltaCount?: number;
	/** numeric value to interpolate into the translated sub (e.g. `across {{count}} projects`) */
	subCount?: number;
}

export const DASHBOARD_METRICS: DashboardMetric[] = [
	{
		id: "m-projects",
		label: "Active projects",
		value: "4",
		delta: "+1",
		sub: "1 paused · 1 archived",
		icon: "projects",
		tone: "brand",
	},
	{
		id: "m-tasks",
		label: "My open tasks",
		value: "12",
		delta: "3 due today",
		sub: "across 4 projects",
		icon: "checkSquare",
		tone: "default",
		deltaAccent: true,
		deltaCount: 3,
		subCount: 4,
	},
	{
		id: "m-sprint",
		label: "Sprint health",
		value: "68%",
		delta: "on track",
		sub: "Aurora · Sprint 14",
		icon: "sprints",
		tone: "brand",
	},
	{
		id: "m-time",
		label: "Logged this week",
		value: "28.5h",
		delta: "71% billable",
		sub: "goal 32h",
		icon: "clock",
		tone: "default",
	},
];

/** Which semantic token colors the tile's icon, count, and progress bar. */
export type ModuleActivityTone = "brand" | "info" | "ext" | "accent" | "success" | "warning";

export interface ModuleActivityEntry {
	id: string;
	name: string;
	icon: IconName;
	count: number;
	/** unit verb, e.g. "updated" / "moved" */
	unit: string;
	/** 0..100 relative bar fill */
	pct: number;
	tone: ModuleActivityTone;
}

export const MODULE_ACTIVITY: ModuleActivityEntry[] = [
	{
		id: "act-tasks",
		name: "Tasks",
		icon: "checkSquare",
		count: 38,
		unit: "updated",
		pct: 80,
		tone: "brand",
	},
	{
		id: "act-board",
		name: "Board",
		icon: "columns",
		count: 24,
		unit: "moved",
		pct: 62,
		tone: "info",
	},
	{ id: "act-docs", name: "Docs", icon: "docs", count: 7, unit: "edited", pct: 30, tone: "ext" },
	{
		id: "act-time",
		name: "Time",
		icon: "clock",
		count: 19,
		unit: "entries",
		pct: 48,
		tone: "accent",
	},
	{
		id: "act-comments",
		name: "Comments",
		icon: "comments",
		count: 11,
		unit: "replies",
		pct: 40,
		tone: "success",
	},
	{
		id: "act-auto",
		name: "Automations",
		icon: "bolt",
		count: 5,
		unit: "runs",
		pct: 22,
		tone: "warning",
	},
];

/** Resolve a `ModuleActivityTone` to its CSS custom property. */
export function moduleActivityToneColor(tone: ModuleActivityTone): string {
	const map: Record<ModuleActivityTone, string> = {
		brand: "var(--tnd-color-brand)",
		info: "var(--tnd-color-info)",
		ext: "var(--tnd-color-ext)",
		accent: "var(--tnd-color-accent)",
		success: "var(--tnd-color-success)",
		warning: "var(--tnd-color-warning)",
	};
	return map[tone];
}

export interface ProjectActivityEntry {
	id: string;
	who: string;
	action: string;
	target: string;
	when: string;
}

export const PROJECT_ACTIVITY: ProjectActivityEntry[] = [
	{ id: "pa-1", who: "Aleks", action: "moved", target: "AUR-108 to Review", when: "12m" },
	{ id: "pa-2", who: "Priya", action: "commented on", target: "AUR-131", when: "40m" },
	{ id: "pa-3", who: "Mira", action: "enabled", target: "Reports module", when: "2h" },
	{ id: "pa-4", who: "Sena", action: "linked doc to", target: "AUR-117", when: "3h" },
	{ id: "pa-5", who: "Jonas", action: "logged 2.5h on", target: "AUR-124", when: "5h" },
];

/**
 * The in-product architecture metaphor layers (Core Workspace → Project Modules
 * → Extension Points → Integrations & Automations). Used on the project overview
 * (Phase 2b) and referenced on the dashboard.
 */
export interface ArchitectureLayer {
	id: string;
	label: string;
	sub: string;
	icon: IconName;
}

export const ARCHITECTURE_LAYERS: ArchitectureLayer[] = [
	{
		id: "arch-core",
		label: "Core Workspace",
		sub: "Tasks · identity · permissions",
		icon: "dashboard",
	},
	{
		id: "arch-modules",
		label: "Project Modules",
		sub: "Board · Backlog · Sprints · Docs · Time",
		icon: "blocks",
	},
	{
		id: "arch-ext",
		label: "Extension Points",
		sub: "Sidebar · Tabs · Drawer · Widgets",
		icon: "plug",
	},
	{
		id: "arch-int",
		label: "Integrations & Automations",
		sub: "GitHub · Community Import · When/then rules",
		icon: "bolt",
	},
];
