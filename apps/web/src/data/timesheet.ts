/**
 * Weekly timesheet fixtures for the global Time screen and the project Time tab.
 *
 * Rows are time entries linked to a task/project; cells are hours per weekday.
 * The live Timer tracks the currently-running entry. Demo-only.
 */

export const WEEK_DAYS = ["Mon 24", "Tue 25", "Wed 26", "Thu 27", "Fri 28", "Sat 29", "Sun 30"];

export interface TimesheetRow {
	id: string;
	/** task reference + title, e.g. "AUR-119 · Drawer slots" */
	task: string;
	projectName: string;
	/** hours per day, index-aligned with WEEK_DAYS */
	hours: number[];
}

export const TIMESHEET_ROWS: TimesheetRow[] = [
	{
		id: "ts-1",
		task: "AUR-119 · Drawer slots",
		projectName: "Aurora Platform",
		hours: [2.0, 1.5, 3.0, 0, 0, 0, 0],
	},
	{
		id: "ts-2",
		task: "AUR-108 · GraphQL gateway",
		projectName: "Aurora Platform",
		hours: [1.5, 2.5, 0, 4.0, 1.0, 0, 0],
	},
	{
		id: "ts-3",
		task: "FRB-44 · Rate limiter",
		projectName: "Frostbyte API",
		hours: [0, 1.0, 2.0, 0, 1.5, 0, 0],
	},
	{
		id: "ts-4",
		task: "OSS-DOC · Module SDK guide",
		projectName: "Tundra OSS",
		hours: [0, 0, 1.5, 1.0, 0.5, 0, 0],
	},
];

export function rowTotal(row: TimesheetRow): number {
	return row.hours.reduce((a, b) => a + b, 0);
}

export function dayTotal(dayIndex: number): number {
	return TIMESHEET_ROWS.reduce((a, r) => a + (r.hours[dayIndex] ?? 0), 0);
}

export function weekTotal(): number {
	return TIMESHEET_ROWS.reduce((a, r) => a + rowTotal(r), 0);
}

/** The task the live timer is currently tracking. */
export const TIMER_CONTEXT = {
	reference: "AUR-119",
	title: "Extension point: task drawer slots",
	projectName: "Aurora Platform",
	/** seconds elapsed on the running entry */
	elapsedSeconds: 4521,
};

/** Format seconds as HH:MM:SS (tabular). */
export function formatDuration(totalSeconds: number): string {
	const h = Math.floor(totalSeconds / 3600);
	const m = Math.floor((totalSeconds % 3600) / 60);
	const s = totalSeconds % 60;
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
