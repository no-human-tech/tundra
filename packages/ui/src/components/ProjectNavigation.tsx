import type { ReactNode } from "react";

import type { NavItem } from "../types.js";
import type { RenderLink } from "./GlobalNavigation.js";

export interface ProjectNavigationProps {
	/** the active project id (already substituted into the item hrefs by the app) */
	projectId: string;
	/** project entries: Overview, Backlog, Board, Sprints, Time, Wiki, Reports */
	items: NavItem[];
	/** project Settings, pinned at the end */
	settingsItem: NavItem;
	/** module-contributed PROJECT entries */
	moduleItems?: NavItem[];
	renderLink?: RenderLink;
	/** accessible name for the <nav> landmark (e.g. translated); defaults to "Project" */
	ariaLabel?: string;
}

function NavLink({ item, renderLink }: { item: NavItem; renderLink?: RenderLink }): ReactNode {
	const content = (
		<>
			{item.icon ? (
				<span className="tnd-nav__icon" aria-hidden="true">
					{item.icon}
				</span>
			) : null}
			<span className="tnd-nav__label">{item.label}</span>
		</>
	);
	if (renderLink) {
		return renderLink(item, content);
	}
	return (
		<a className="tnd-nav__link" href={item.href} aria-current={item.isActive ? "page" : undefined}>
			{content}
		</a>
	);
}

/**
 * The PROJECT-scoped navigation surface, mounted ONLY inside a project. It has
 * NO slot for global entries — there is deliberately no `globalItems` prop — so
 * by construction it cannot blend global concerns into project-scoped menus.
 *
 * Landmark: a second <nav aria-label="Project"> (distinct from the Global nav)
 * so assistive tech can tell the two contexts apart. Rendered as a horizontal
 * link bar; each item is a real route link (not an ARIA tab) using
 * aria-current="page" for the active route. See report 02 §2 and §3.
 */
export function ProjectNavigation({
	projectId,
	items,
	settingsItem,
	moduleItems,
	renderLink,
	ariaLabel = "Project",
}: ProjectNavigationProps) {
	const allItems = moduleItems
		? [...items, ...moduleItems, settingsItem]
		: [...items, settingsItem];

	return (
		<nav className="tnd-projectnav" aria-label={ariaLabel} data-project-id={projectId}>
			<ul className="tnd-nav__list">
				{allItems.map((item) => (
					<li key={item.id}>
						<NavLink item={item} renderLink={renderLink} />
					</li>
				))}
			</ul>
		</nav>
	);
}
