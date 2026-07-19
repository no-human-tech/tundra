import type { ReactNode } from "react";

import { SkipLink } from "../primitives/SkipLink.js";

export interface AppShellProps {
	/** <GlobalNavigation/> instance — present on every route (LEFT rail) */
	globalNav: ReactNode;
	/** when true, the shell narrows the sidebar grid column to icon-only width */
	sidebarCollapsed?: boolean;
	/**
	 * Topbar slot: when provided it is rendered verbatim inside the banner. If
	 * omitted, the shell composes a default topbar from `brand`, `breadcrumb`,
	 * `searchHint`, and `topbarActions`.
	 */
	topbar?: ReactNode;
	/** brand mark/link shown at the start of the default topbar */
	brand?: ReactNode;
	/** breadcrumb trail shown in the default topbar (e.g. Projects / Aurora / Board) */
	breadcrumb?: ReactNode;
	/** context-aware search affordance + command-palette hint in the default topbar */
	searchHint?: ReactNode;
	/** trailing topbar controls in the default topbar (create, notifications, user) */
	topbarActions?: ReactNode;
	/** project identity / context bar — present ONLY inside a project */
	projectHeader?: ReactNode;
	/** <ProjectNavigation/> — present ONLY inside a project */
	projectNav?: ReactNode;
	/** routed main content */
	children: ReactNode;
	/** id of the main landmark the skip link targets (default "tnd-main") */
	mainId?: string;
	/** accessible name for the default topbar breadcrumb <nav> (e.g. translated); defaults to "Breadcrumb" */
	breadcrumbLabel?: string;
	/** overridable text for the skip link (e.g. translated); defaults to "Skip to content" */
	skipLinkLabel?: string;
}

/**
 * Top-level structural layout. Pure presentation: it receives slots, not data.
 *
 * Landmarks: exactly one banner (topbar) and one main. The global nav is always
 * present as the LEFT rail; the project header + project nav mount ONLY when in
 * project scope and are passed as separate slots, so a global route can never
 * show a stale project sub-nav. The two nav surfaces are distinct,
 * separately-labeled landmarks (set by GlobalNavigation / ProjectNavigation).
 *
 * Focus: <main> has tabindex=-1; the skip link (first focusable element) and
 * route changes move focus to it.
 */
export function AppShell({
	globalNav,
	sidebarCollapsed,
	topbar,
	brand,
	breadcrumb,
	searchHint,
	topbarActions,
	projectHeader,
	projectNav,
	children,
	mainId = "tnd-main",
	breadcrumbLabel = "Breadcrumb",
	skipLinkLabel,
}: AppShellProps) {
	const composedTopbar =
		topbar ??
		(brand || breadcrumb || searchHint || topbarActions ? (
			<>
				{brand ? <div className="tnd-topbar__brand">{brand}</div> : null}
				{breadcrumb ? (
					<nav className="tnd-topbar__breadcrumb" aria-label={breadcrumbLabel}>
						{breadcrumb}
					</nav>
				) : null}
				<span className="tnd-topbar__spacer" />
				{searchHint}
				{topbarActions ? <div className="tnd-topbar__actions">{topbarActions}</div> : null}
			</>
		) : null);

	return (
		<>
			<SkipLink targetId={mainId} label={skipLinkLabel} />
			<div className="tnd-appshell" data-sidebar-collapsed={sidebarCollapsed ? "true" : undefined}>
				<header className="tnd-topbar" role="banner">
					{composedTopbar}
				</header>

				{globalNav}

				<div className="tnd-content">
					{projectHeader}
					{projectNav}
					<main id={mainId} className="tnd-main tnd-scroll" tabIndex={-1}>
						{children}
					</main>
				</div>
			</div>
		</>
	);
}
