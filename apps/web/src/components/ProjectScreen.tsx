import type { ReactNode } from "react";
import { useParams } from "react-router-dom";

import { useProjects, type SampleProject } from "../data/index.js";

// Side-effect import: ships the project-screen page scaffolding (built on the
// same --tnd-* tokens). Imported here so the styles load without touching
// main.tsx / app.css. Importing once from this shared module is enough — every
// project screen renders through <ProjectScreen> / its section helpers.
import "./projectScreens.css";

/**
 * Resolves the project for the current route from the `:projectId` param.
 *
 * ProjectLayout already guards that the project exists before rendering any
 * sub-page (it redirects to /projects otherwise), so within a project screen the
 * project is effectively always present; the optional return keeps the contract
 * honest if a screen is ever rendered outside that guard.
 */
export function useProject(): SampleProject | undefined {
	const { projectId } = useParams();
	const { findProject } = useProjects();
	return findProject(projectId);
}

/**
 * The project-scoped href builder. Every link on a project screen MUST stay
 * inside the project (`/projects/:id/<section>`) — never a global route.
 */
export function useProjectHref(): (section: string) => string {
	const { projectId } = useParams();
	return (section: string) => `/projects/${projectId}/${section}`;
}

export interface ProjectScreenProps {
	children: ReactNode;
}

/**
 * The root wrapper for a project sub-page. The project <h1> page heading lives in
 * the project context bar (ProjectHeader, id `tnd-project-title`) rendered by
 * ProjectLayout, and route-change focus targets it — so a sub-page never renders a
 * second <h1>; it starts at the <h2> level via <ProjectPageHeader> / <ProjectSection>.
 */
export function ProjectScreen({ children }: ProjectScreenProps) {
	return <div className="tnd-page">{children}</div>;
}

export interface ProjectPageHeaderProps {
	/** the section name, e.g. "Board" — rendered as the page's top <h2> */
	title: ReactNode;
	/** mono kicker above the title (e.g. the module that contributes the screen) */
	kicker?: ReactNode;
	/** supporting lead paragraph */
	lead?: ReactNode;
	/** end-aligned actions (project-scoped only) */
	actions?: ReactNode;
	/**
	 * When true the heading (and any kicker/lead) is visually hidden but remains
	 * available to screen readers. Use on tool-type views where the active nav tab
	 * already communicates the context visually.
	 */
	titleHidden?: boolean;
}

/**
 * The top heading block of a project sub-page. Uses <h2> (the project <h1> is the
 * context-bar title) so the document keeps a single <h1> per the page pattern.
 *
 * When `titleHidden` is true the heading block is rendered with `.tnd-sr-only` so
 * it is not visible but is still reachable by assistive technology. Actions remain
 * visible in that case — they are wrapped in their own container.
 */
export function ProjectPageHeader({
	title,
	kicker,
	lead,
	actions,
	titleHidden,
}: ProjectPageHeaderProps) {
	if (titleHidden) {
		return (
			<>
				<h2 className="tnd-sr-only">{title}</h2>
				{actions ? (
					<div className="tnd-projhead tnd-row" style={{ justifyContent: "flex-end" }}>
						<div className="tnd-row" style={{ flex: "none" }}>
							{actions}
						</div>
					</div>
				) : null}
			</>
		);
	}
	return (
		<header className="tnd-projhead tnd-row tnd-row--between" style={{ alignItems: "flex-start" }}>
			<div style={{ minWidth: 0 }}>
				{kicker ? <p className="tnd-kicker">{kicker}</p> : null}
				<h2 className="tnd-projhead__title">{title}</h2>
				{lead ? <p className="tnd-projhead__lead">{lead}</p> : null}
			</div>
			{actions ? (
				<div className="tnd-row" style={{ flex: "none" }}>
					{actions}
				</div>
			) : null}
		</header>
	);
}

export interface ProjectSectionProps {
	title: ReactNode;
	hint?: ReactNode;
	actions?: ReactNode;
	children: ReactNode;
	/** accessible label for the section landmark (defaults to a stringified title) */
	"aria-label"?: string;
}

/** A labelled content section inside a project sub-page (an <h3> under the page <h2>). */
export function ProjectSection({
	title,
	hint,
	actions,
	children,
	"aria-label": ariaLabel,
}: ProjectSectionProps) {
	return (
		<section className="tnd-projsection" aria-label={ariaLabel}>
			<div className="tnd-projsection__head">
				<h3 className="tnd-projsection__title">{title}</h3>
				{hint ? <span className="tnd-projsection__hint">{hint}</span> : null}
				{actions ? <span className="tnd-projsection__actions">{actions}</span> : null}
			</div>
			{children}
		</section>
	);
}
