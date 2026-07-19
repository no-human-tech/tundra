/**
 * Project fixtures.
 *
 * IMPORTANT — stable ids: the e2e suite and tests reference `proj-core`,
 * `proj-web`, `proj-ops`. The display NAME of `proj-core` is "Aurora Platform"
 * (matching the comp), but the id stays `proj-core`. Phase 2b project screens
 * consume these via `findProject`.
 *
 * Each project carries its enabled modules (by catalog name), workflow method,
 * owner, health, and a status. The project context bar renders the enabled
 * modules as pills.
 */

import { PEOPLE, type Person } from "./people.js";

export type ProjectStatus = "Active" | "Paused" | "Archived";
export type ProjectMethod = "scrum" | "kanban";

export interface SampleProject {
	id: string;
	key: string;
	name: string;
	description: string;
	status: ProjectStatus;
	method: ProjectMethod;
	owner: Person;
	/** relative "updated" label, e.g. "2h ago" */
	updated: string;
	/** completion percentage 0..100 */
	progress: number;
	openTasks: number;
	memberCount: number;
	/** enabled modules, by catalog display name */
	modules: string[];
}

export const sampleProjects: SampleProject[] = [
	{
		id: "proj-core",
		key: "AUR",
		name: "Aurora Platform",
		description:
			"The flagship modular workspace — Tundra's reference project. Tasks, board, sprints, docs and reports all enabled.",
		status: "Active",
		method: "scrum",
		owner: PEOPLE.mira,
		updated: "2h ago",
		progress: 68,
		openTasks: 42,
		memberCount: 8,
		modules: ["Tasks", "Board", "Backlog", "Sprints", "Time", "Docs", "Reports"],
	},
	{
		id: "proj-web",
		key: "FRB",
		name: "Frostbyte API",
		description: "The GraphQL gateway and module API service.",
		status: "Active",
		method: "scrum",
		owner: PEOPLE.aleks,
		updated: "1d ago",
		progress: 54,
		openTasks: 23,
		memberCount: 5,
		modules: ["Tasks", "Board", "Backlog", "Sprints", "Docs", "Integrations"],
	},
	{
		id: "proj-ops",
		key: "PRM",
		name: "Permafrost Infra",
		description: "Internal operations, infrastructure and helpdesk.",
		status: "Paused",
		method: "kanban",
		owner: PEOPLE.jonas,
		updated: "2w ago",
		progress: 32,
		openTasks: 17,
		memberCount: 6,
		modules: ["Tasks", "Board", "Time", "Automations", "Integrations"],
	},
	{
		id: "proj-glacier",
		key: "GLC",
		name: "Glacier Docs",
		description: "Documentation site and knowledge base.",
		status: "Active",
		method: "kanban",
		owner: PEOPLE.sena,
		updated: "3d ago",
		progress: 81,
		openTasks: 9,
		memberCount: 4,
		modules: ["Tasks", "Board", "Docs"],
	},
	{
		id: "proj-oss",
		key: "OSS",
		name: "Tundra OSS",
		description: "The open-source community project and extension marketplace.",
		status: "Active",
		method: "kanban",
		owner: PEOPLE.priya,
		updated: "5h ago",
		progress: 47,
		openTasks: 61,
		memberCount: 24,
		modules: ["Tasks", "Board", "Backlog", "Docs", "Roadmap"],
	},
	{
		id: "proj-borealis",
		key: "BOR",
		name: "Borealis Mobile",
		description: "The companion mobile application (archived).",
		status: "Archived",
		method: "kanban",
		owner: PEOPLE.mira,
		updated: "1mo ago",
		progress: 100,
		openTasks: 0,
		memberCount: 3,
		modules: ["Tasks", "Board", "Time"],
	},
];

export function findProject(id: string | undefined): SampleProject | undefined {
	return sampleProjects.find((p) => p.id === id);
}

/** The default/active project (Aurora Platform). */
export const DEFAULT_PROJECT: SampleProject = sampleProjects[0]!;
