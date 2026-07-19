/**
 * Topbar chrome derivation — breadcrumb trail + context-aware search scope.
 *
 * Global routes get a one-level crumb (the page title); project routes get a
 * Projects / {project} / {section} trail and a project-scoped search scope. This
 * keeps the global-vs-project separation visible in the chrome too.
 *
 * Labels are translated in the web layer from the domain nav entry keys (the
 * domain still owns order/keys/routes — the separation invariant is untouched).
 */

import type { TFunction } from "i18next";

import { GLOBAL_NAV, PROJECT_NAV } from "@tundra/domain";

import type { Crumb } from "./Topbar.js";

/** Map a global route -> its domain nav entry key (for translation). */
const GLOBAL_ROUTE_KEY = new Map(GLOBAL_NAV.map((e) => [e.route, e.key]));
/** Project section key -> itself (the section path segment is the nav key). */
const PROJECT_SECTION_KEYS = new Set(PROJECT_NAV.map((e) => e.key));

export interface TopbarChrome {
	breadcrumbs: Crumb[];
	searchScope: string;
}

/** Build the topbar chrome for a GLOBAL route. */
export function globalChrome(pathname: string, t: TFunction): TopbarChrome {
	// Match the most specific global route prefix to its translation key.
	let key = "dashboard";
	for (const entry of GLOBAL_NAV) {
		if (pathname === entry.route || pathname.startsWith(`${entry.route}/`)) {
			key = entry.key;
			break;
		}
	}
	if (pathname === "/" || pathname === "/dashboard") {
		key = GLOBAL_ROUTE_KEY.get("/dashboard") ?? "dashboard";
	}
	return {
		breadcrumbs: [{ label: t(`nav.global.${key}` as never, { defaultValue: key }) }],
		searchScope: t("topbar.searchGlobal"),
	};
}

/**
 * Build the topbar chrome for a PROJECT route (/projects/:projectId/:section).
 * Takes the already-resolved project NAME rather than looking it up itself —
 * callers (ProjectLayout) resolve the project via the live `useProjects()`
 * context so newly-created projects show up here too.
 */
export function projectChrome(
	projectId: string,
	projectName: string | undefined,
	section: string | undefined,
	t: TFunction,
): TopbarChrome {
	const resolvedName = projectName ?? t("nav.project.ariaLabel");
	const sectionKey = section && PROJECT_SECTION_KEYS.has(section) ? section : "overview";
	return {
		breadcrumbs: [
			{ label: t("breadcrumb.projects"), href: "/projects" },
			{ label: resolvedName, href: `/projects/${projectId}/overview` },
			{ label: t(`nav.project.${sectionKey}` as never, { defaultValue: sectionKey }) },
		],
		searchScope: t("topbar.searchInProject", { project: resolvedName }),
	};
}
