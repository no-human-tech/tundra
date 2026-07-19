/**
 * Team report fixtures for the global Time screen — the design spec §7.10:
 * a workspace-wide "team report" table (person, role, total hours, billable
 * hours, utilization %), distinct from the personal weekly timesheet card.
 * Demo-only; the real app resolves this from logged time entries + capacity.
 */

export interface TeamReportRow {
	id: string;
	person: string;
	role: string;
	/** total hours logged this week */
	totalHours: number;
	/** of the total, how many were billable */
	billableHours: number;
	/** utilization against a standard work week, 0-100 */
	utilizationPct: number;
}

export const TEAM_REPORT_ROWS: TeamReportRow[] = [
	{
		id: "tr-mira",
		person: "Mira Lindqvist",
		role: "Owner",
		totalHours: 34.5,
		billableHours: 21.0,
		utilizationPct: 86,
	},
	{
		id: "tr-aleks",
		person: "Aleks Novak",
		role: "Admin",
		totalHours: 31.0,
		billableHours: 24.5,
		utilizationPct: 78,
	},
	{
		id: "tr-sena",
		person: "Sena Okafor",
		role: "Member",
		totalHours: 28.5,
		billableHours: 19.5,
		utilizationPct: 71,
	},
	{
		id: "tr-jonas",
		person: "Jonas Berg",
		role: "Member",
		totalHours: 36.0,
		billableHours: 30.0,
		utilizationPct: 90,
	},
	{
		id: "tr-priya",
		person: "Priya Rao",
		role: "Member",
		totalHours: 25.5,
		billableHours: 14.0,
		utilizationPct: 64,
	},
];

/** Client-side CSV export for the team report — demo-only, no backend call. */
export function teamReportToCsv(rows: TeamReportRow[]): string {
	const header = ["Person", "Role", "Total hours", "Billable hours", "Utilization %"];
	const lines = rows.map((r) =>
		[r.person, r.role, r.totalHours, r.billableHours, r.utilizationPct].join(","),
	);
	return [header.join(","), ...lines].join("\n");
}
