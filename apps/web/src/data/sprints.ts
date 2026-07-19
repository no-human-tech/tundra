/**
 * Sprint fixtures for the Aurora Platform (`proj-core`) project.
 *
 * Phase 2b renders sprint progress, capacity and burndown. Demo-only.
 */

export type SprintState = "active" | "planned" | "completed";

export interface Sprint {
	id: string;
	name: string;
	state: SprintState;
	/** display date range, e.g. "Jun 16 – Jun 29" */
	range: string;
	/** days remaining (active sprints) */
	daysLeft?: number;
	committedPoints: number;
	completedPoints: number;
	goal: string;
}

export const SPRINTS: Sprint[] = [
	{
		id: "sprint-14",
		name: "Sprint 14",
		state: "active",
		range: "Jun 16 – Jun 29",
		daysLeft: 4,
		committedPoints: 41,
		completedPoints: 28,
		goal: "Ship the extension-point host and module manifest v2.",
	},
	{
		id: "sprint-15",
		name: "Sprint 15",
		state: "planned",
		range: "Jun 30 – Jul 13",
		committedPoints: 38,
		completedPoints: 0,
		goal: "Board swimlanes, WIP limits, and saved filters.",
	},
	{
		id: "sprint-13",
		name: "Sprint 13",
		state: "completed",
		range: "Jun 02 – Jun 15",
		committedPoints: 44,
		completedPoints: 44,
		goal: "GraphQL gateway and notification badge service.",
	},
];

export const ACTIVE_SPRINT: Sprint = SPRINTS[0]!;
