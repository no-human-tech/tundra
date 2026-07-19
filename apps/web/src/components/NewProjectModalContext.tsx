/**
 * Shared "New project" modal state — the single instance every entry point
 * (topbar `+`, the dashboard CTA, the Projects page CTA, and its dashed
 * "create new project" tile) opens via `useNewProjectModal().open()`.
 *
 * The modal itself is rendered once here, as a sibling of the routed tree, so
 * it survives navigation and stays a single source of truth regardless of
 * which entry point opened it.
 */

import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import type { SampleProject } from "../data/index.js";
import { useProjects } from "../data/index.js";
import { NewProjectModal } from "./NewProjectModal.js";

export interface NewProjectModalContextValue {
	/** open the New Project modal */
	open: () => void;
}

const NewProjectModalContext = createContext<NewProjectModalContextValue | null>(null);

export function NewProjectModalProvider({ children }: { children: ReactNode }) {
	const [isOpen, setIsOpen] = useState(false);
	const { addProject } = useProjects();
	const navigate = useNavigate();

	const handleCreate = (project: SampleProject) => {
		addProject(project);
		setIsOpen(false);
		navigate(`/projects/${project.id}/overview`);
	};

	return (
		<NewProjectModalContext.Provider value={{ open: () => setIsOpen(true) }}>
			{children}
			<NewProjectModal open={isOpen} onClose={() => setIsOpen(false)} onCreate={handleCreate} />
		</NewProjectModalContext.Provider>
	);
}

/** Access the New Project modal opener. Must be called inside a `NewProjectModalProvider`. */
export function useNewProjectModal(): NewProjectModalContextValue {
	const ctx = useContext(NewProjectModalContext);
	if (!ctx) {
		throw new Error("useNewProjectModal must be called inside a NewProjectModalProvider");
	}
	return ctx;
}
