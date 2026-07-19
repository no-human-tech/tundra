/**
 * Report definition fixtures for the global Reports screen and the project
 * Reports tab. Each report is contributed by an enabled module.
 */

import type { IconName } from "@tundra/ui";

export interface ReportDefinition {
	id: string;
	name: string;
	description: string;
	/** the module that contributes this report */
	module: string;
	icon: IconName;
	/** headline metric, e.g. "41 pts" */
	metric: string;
	/** short trend/context line */
	trend: string;
}

export const REPORTS: ReportDefinition[] = [
	{
		id: "report-velocity",
		name: "Velocity",
		description: "Completed story points per sprint, trailing six sprints.",
		module: "Sprints",
		icon: "bars",
		metric: "41 pts",
		trend: "+6 vs. last sprint",
	},
	{
		id: "report-throughput",
		name: "Throughput",
		description: "Work items completed per week across all enabled modules.",
		module: "Reports",
		icon: "bars",
		metric: "23 / wk",
		trend: "steady",
	},
	{
		id: "report-burndown",
		name: "Sprint burndown",
		description: "Remaining scope vs. ideal trend for the active sprint.",
		module: "Sprints",
		icon: "sprints",
		metric: "68%",
		trend: "on track",
	},
	{
		id: "report-time",
		name: "Time by project",
		description: "Logged hours split by project and billable status.",
		module: "Time Tracking",
		icon: "clock",
		metric: "28.5h",
		trend: "71% billable",
	},
];

/** A report that has no data yet — used to show the empty state. */
export const EMPTY_REPORT: ReportDefinition = {
	id: "report-custom",
	name: "Custom report",
	description: "Build a cross-module report from any metric.",
	module: "Reports",
	icon: "review",
	metric: "—",
	trend: "no data yet",
};
