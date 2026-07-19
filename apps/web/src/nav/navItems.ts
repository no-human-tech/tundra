/**
 * Builds the UI `NavItem[]` arrays from the canonical domain nav definitions.
 *
 * The domain (`@tundra/domain`) owns the ordered lists, labels, and routes
 * (GLOBAL_NAV / PROJECT_NAV) — the single source of truth. This module only
 * adapts them for the presentational nav components: it substitutes `:projectId`
 * into project routes and computes the active item from the current pathname.
 *
 * Separation invariant: global items come ONLY from GLOBAL_NAV and project items
 * ONLY from PROJECT_NAV. The two builders never read the other list.
 */

import { createElement } from "react";

import type { TFunction } from "i18next";

import { GLOBAL_NAV, PROJECT_NAV } from "@tundra/domain";
import { Icon, type IconName, type NavItem } from "@tundra/ui";

/** Per-nav-entry decorative icon. Keys match the domain NavEntryDef.key values. */
const GLOBAL_NAV_ICONS: Record<string, IconName> = {
	dashboard: "dashboard",
	projects: "projects",
	myTasks: "checkSquare",
	time: "clock",
	reports: "bars",
	extensions: "blocks",
	workspaceSettings: "settings",
};

const PROJECT_NAV_ICONS: Record<string, IconName> = {
	overview: "dashboard",
	backlog: "list",
	board: "columns",
	sprints: "sprints",
	time: "clock",
	wiki: "docs",
	reports: "bars",
	settings: "settings",
};

function navIcon(icons: Record<string, IconName>, key: string) {
	const name = icons[key];
	return name ? createElement(Icon, { name, size: 18 }) : undefined;
}

function isActive(href: string, pathname: string): boolean {
	if (href === "/dashboard") {
		return pathname === "/" || pathname === "/dashboard";
	}
	return pathname === href || pathname.startsWith(`${href}/`);
}

export interface GlobalNavBuild {
	items: NavItem[];
	settingsItem: NavItem;
}

export function buildGlobalNav(
	pathname: string,
	t: TFunction,
	badgeCounts: Record<string, number> = {},
): GlobalNavBuild {
	const all = GLOBAL_NAV.map((entry): NavItem => {
		const item: NavItem = {
			id: entry.key,
			// The domain owns order/keys/routes; the web layer translates the label
			// from the entry key (the separation invariant is untouched).
			label: t(`nav.global.${entry.key}` as never, { defaultValue: entry.label }),
			href: entry.route,
			isActive: isActive(entry.route, pathname),
			icon: navIcon(GLOBAL_NAV_ICONS, entry.key),
		};
		const count = badgeCounts[entry.key];
		if (typeof count === "number") {
			item.badgeCount = count;
		}
		return item;
	});

	// Workspace Settings is pinned/separated; split it out of the main list.
	const settingsItem = all.find((i) => i.id === "workspaceSettings") as NavItem;
	const items = all.filter((i) => i.id !== "workspaceSettings");
	return { items, settingsItem };
}

export interface ProjectNavBuild {
	items: NavItem[];
	settingsItem: NavItem;
}

export function buildProjectNav(
	projectId: string,
	pathname: string,
	t: TFunction,
): ProjectNavBuild {
	const all = PROJECT_NAV.map((entry): NavItem => {
		const href = entry.route.replace(":projectId", projectId);
		return {
			id: entry.key,
			label: t(`nav.project.${entry.key}` as never, { defaultValue: entry.label }),
			href,
			isActive: isActive(href, pathname),
			icon: navIcon(PROJECT_NAV_ICONS, entry.key),
		};
	});

	const settingsItem = all.find((i) => i.id === "settings") as NavItem;
	const items = all.filter((i) => i.id !== "settings");
	return { items, settingsItem };
}
