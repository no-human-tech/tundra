/**
 * Project-scoped role vocabulary for the New Project modal's Team section.
 *
 * Distinct from the WORKSPACE role on `Person.role` (Owner/Admin/Member —
 * see `people.ts`): this is the role a person plays ON A GIVEN PROJECT. Every
 * new project requires at least one INCLUDED member with the "Project
 * Manager" role before it can be created.
 */
export const PROJECT_ROLE_OPTIONS = [
	"Project Manager",
	"Contributor",
	"Reviewer",
	"Viewer",
] as const;

export type ProjectRole = (typeof PROJECT_ROLE_OPTIONS)[number];

export const DEFAULT_PROJECT_ROLE: ProjectRole = "Contributor";

/** Project role -> newProject.roles.<key> i18n key. */
export const PROJECT_ROLE_I18N_KEY: Record<ProjectRole, string> = {
	"Project Manager": "newProject.roles.projectManager",
	Contributor: "newProject.roles.contributor",
	Reviewer: "newProject.roles.reviewer",
	Viewer: "newProject.roles.viewer",
};
