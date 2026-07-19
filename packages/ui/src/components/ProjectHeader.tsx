import type { ReactNode } from "react";

import { Icon } from "../primitives/Icon.js";

export interface Breadcrumb {
	label: string;
	href?: string;
}

export interface ProjectHeaderProject {
	id: string;
	key: string;
	name: string;
	avatarUrl?: string;
	description?: string;
	/** display status, e.g. "Active" / "Paused" — rendered as a labeled badge */
	status?: string;
	/** workflow method label, e.g. "Continuous flow · WIP 7" or "Sprint 14" */
	methodLabel?: string;
}

export interface ProjectHeaderProps {
	project: ProjectHeaderProject;
	/** project-scoped actions, e.g. "New work item" */
	actions?: ReactNode;
	breadcrumbs?: Breadcrumb[];
	/**
	 * Enabled-module pills shown in the context bar. Presence switches the header
	 * into the project context-bar layout (selector + Active badge + pills +
	 * "Manage →").
	 */
	modules?: string[];
	/** total enabled-module count shown next to the manage link (defaults to modules.length) */
	moduleCount?: number;
	/** href for the "Manage →" link (project settings); use OR `onManage` */
	manageHref?: string;
	/** click handler for "Manage →" when not a link */
	onManage?: () => void;
	/** click handler for the project selector affordance (opens a switcher) */
	onSelectProject?: () => void;
	/** map a project status to a chip tone class suffix; defaults sensibly */
	statusTone?: "success" | "warning" | "neutral" | "ext";
	/** accessible name for the breadcrumb <nav> (e.g. translated); defaults to "Breadcrumb" */
	breadcrumbLabel?: string;
	/**
	 * accessible name for the project selector button (e.g. translated); receives the
	 * project name. Defaults to `Switch project. Current: ${name}`.
	 */
	selectProjectLabel?: (projectName: string) => string;
	/**
	 * visible text of the "Manage" link/button (e.g. translated); receives the module
	 * count. Defaults to `${count} modules · Manage →`.
	 */
	manageLabel?: (count: number) => ReactNode;
}

const STATUS_TONE_FALLBACK: Record<string, "success" | "warning" | "neutral" | "ext"> = {
	active: "success",
	paused: "warning",
	archived: "neutral",
	experimental: "ext",
};

/**
 * Project identity band shown above ProjectNavigation, only in project scope.
 *
 * Semantics: a section <header> (NOT the app banner — that is the topbar) with an
 * optional Breadcrumb nav and exactly one <h1> = the project name (the page
 * heading anchor, focus-managed by the app on project switch via tabindex=-1).
 *
 * Two layouts:
 *  - context bar (when `modules` is provided): a selector affordance, an Active
 *    badge, enabled-module pills, and a "Manage →" link.
 *  - legacy bar (default): key + title + actions.
 */
export function ProjectHeader({
	project,
	actions,
	breadcrumbs,
	modules,
	moduleCount,
	manageHref,
	onManage,
	onSelectProject,
	statusTone,
	breadcrumbLabel = "Breadcrumb",
	selectProjectLabel,
	manageLabel,
}: ProjectHeaderProps) {
	const breadcrumbNav =
		breadcrumbs && breadcrumbs.length > 0 ? (
			<nav className="tnd-projectheader__breadcrumb" aria-label={breadcrumbLabel}>
				<ol className="tnd-projectheader__breadcrumb-list">
					{breadcrumbs.map((crumb, index) => {
						const isLast = index === breadcrumbs.length - 1;
						return (
							<li key={`${crumb.label}-${index}`}>
								{crumb.href && !isLast ? (
									<a href={crumb.href}>{crumb.label}</a>
								) : (
									<span aria-current={isLast ? "page" : undefined}>{crumb.label}</span>
								)}
								{!isLast ? (
									<span className="tnd-projectheader__breadcrumb-sep" aria-hidden="true">
										{" / "}
									</span>
								) : null}
							</li>
						);
					})}
				</ol>
			</nav>
		) : null;

	// Context-bar layout (richer; matches the comp).
	if (modules) {
		const tone =
			statusTone ?? STATUS_TONE_FALLBACK[(project.status ?? "").toLowerCase()] ?? "neutral";
		const count = moduleCount ?? modules.length;
		return (
			<header className="tnd-projectheader">
				{breadcrumbNav}
				<div className="tnd-projectctx">
					<button
						type="button"
						className="tnd-projectctx__selector"
						onClick={onSelectProject}
						aria-haspopup="listbox"
						aria-label={
							selectProjectLabel
								? selectProjectLabel(project.name)
								: `Switch project. Current: ${project.name}`
						}
					>
						<span className="tnd-projectctx__key" aria-hidden="true">
							{project.key}
						</span>
						<h1 className="tnd-projectctx__title" tabIndex={-1} id="tnd-project-title">
							{project.name}
						</h1>
						<span className="tnd-projectctx__chevron" aria-hidden="true">
							<Icon name="chevronDown" size={16} />
						</span>
					</button>

					{project.status ? (
						<span
							className={["tnd-chip", tone === "neutral" ? "" : `tnd-chip--${tone}`]
								.filter(Boolean)
								.join(" ")}
						>
							{project.status}
						</span>
					) : null}
					{project.methodLabel ? (
						<span className="tnd-badge tnd-badge--neutral">{project.methodLabel}</span>
					) : null}

					{modules.length > 0 ? (
						<div className="tnd-projectctx__modules">
							{modules.map((m) => (
								<span key={m} className="tnd-projectctx__module-pill">
									{m}
								</span>
							))}
						</div>
					) : null}

					{actions ? <div className="tnd-projectctx__actions">{actions}</div> : null}

					{manageHref ? (
						<a className="tnd-projectctx__manage" href={manageHref}>
							{manageLabel ? manageLabel(count) : `${count} modules · Manage →`}
						</a>
					) : (
						<button type="button" className="tnd-projectctx__manage" onClick={onManage}>
							{manageLabel ? manageLabel(count) : `${count} modules · Manage →`}
						</button>
					)}
				</div>
			</header>
		);
	}

	// Legacy layout (back-compat with existing apps/web usage).
	return (
		<header className="tnd-projectheader">
			{breadcrumbNav}
			<div className="tnd-projectheader__bar">
				<div className="tnd-projectheader__identity">
					<span className="tnd-projectheader__key">{project.key}</span>
					<h1 className="tnd-projectheader__title" tabIndex={-1} id="tnd-project-title">
						{project.name}
					</h1>
				</div>
				{actions ? <div className="tnd-projectheader__actions">{actions}</div> : null}
			</div>
		</header>
	);
}
