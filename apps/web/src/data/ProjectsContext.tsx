/**
 * Live project-list context.
 *
 * `data/projects.ts` ships the demo FIXTURES (`sampleProjects`) — a static
 * seed. This context wraps that seed in React state so the New Project modal
 * (any of its 4 entry points) can append a project at runtime and have it
 * show up immediately on `/projects`, resolve at `/projects/:id/overview`,
 * and appear in the topbar/project-chrome breadcrumb — all without a backend.
 *
 * Screens that only ever READ the fixed demo list (e.g. reports rollups) can
 * keep importing `sampleProjects` directly; anything that must reflect a
 * newly-created project (ProjectsPage, ProjectLayout, project screens, the
 * topbar chrome) should go through `useProjects()` instead.
 */

import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { sampleProjects, type SampleProject } from "./projects.js";

export interface ProjectsContextValue {
	/** every project currently known to the app: the fixtures plus any created this session */
	projects: SampleProject[];
	/** resolve a project by id, or undefined if it doesn't exist */
	findProject: (id: string | undefined) => SampleProject | undefined;
	/** append a newly-created project to the list */
	addProject: (project: SampleProject) => void;
}

const ProjectsContext = createContext<ProjectsContextValue | null>(null);

/** Wrap the app to make the live project list available via `useProjects()`. */
export function ProjectsProvider({ children }: { children: ReactNode }) {
	const [projects, setProjects] = useState<SampleProject[]>(sampleProjects);

	const value = useMemo<ProjectsContextValue>(
		() => ({
			projects,
			findProject: (id) => projects.find((p) => p.id === id),
			addProject: (project) => setProjects((prev) => [...prev, project]),
		}),
		[projects],
	);

	return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}

/** Access the live project list. Must be called inside a `ProjectsProvider`. */
export function useProjects(): ProjectsContextValue {
	const ctx = useContext(ProjectsContext);
	if (!ctx) {
		throw new Error("useProjects must be called inside a ProjectsProvider");
	}
	return ctx;
}
