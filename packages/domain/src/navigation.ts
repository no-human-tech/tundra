/**
 * Navigation rules as constants.
 *
 * Two disjoint route namespaces — global and project — are a hard invariant.
 * `apps/web` renders exactly two nav components, one fed by `GLOBAL_NAV` and one
 * by `PROJECT_NAV`; there is never a blended menu. Module nav contributions are
 * validated against `assertNavScope` at registration time.
 *
 * See architect report 01 §5 and ADR-0004.
 */

export const GLOBAL_ROUTES = {
	dashboard: "/dashboard",
	projects: "/projects",
	myTasks: "/my-tasks",
	time: "/time",
	reports: "/reports",
	extensions: "/extensions",
	workspaceSettings: "/settings",
} as const;

export const PROJECT_ROUTE_PATTERNS = {
	overview: "/projects/:projectId/overview",
	backlog: "/projects/:projectId/backlog",
	board: "/projects/:projectId/board",
	sprints: "/projects/:projectId/sprints",
	time: "/projects/:projectId/time",
	wiki: "/projects/:projectId/wiki",
	reports: "/projects/:projectId/reports",
	settings: "/projects/:projectId/settings",
} as const;

export type NavScope = "global" | "project";

/**
 * A route belongs to the project namespace iff it begins with
 * `/projects/:projectId/`. Everything else (including the `/projects` list) is
 * global.
 */
export function navScopeOf(routePattern: string): NavScope {
	return /^\/projects\/:projectId\//.test(routePattern) ? "project" : "global";
}

/**
 * Hard rule: a nav entry must match its declared scope. Throws on a mismatch so
 * the registry can reject scope-violating module contributions.
 */
export function assertNavScope(routePattern: string, declared: NavScope): void {
	if (navScopeOf(routePattern) !== declared) {
		throw new Error(`Nav scope violation: ${routePattern} is not ${declared}-scoped`);
	}
}

/** A single declared navigation entry. The single source of truth for order + labels. */
export interface NavEntryDef {
	key: string;
	label: string;
	route: string;
}

/**
 * Ordered global navigation. Routes are taken directly from `GLOBAL_ROUTES`, so
 * this list can never drift from the canonical route constants.
 */
export const GLOBAL_NAV: readonly NavEntryDef[] = [
	{ key: "dashboard", label: "Dashboard", route: GLOBAL_ROUTES.dashboard },
	{ key: "projects", label: "Projects", route: GLOBAL_ROUTES.projects },
	{ key: "myTasks", label: "My Tasks", route: GLOBAL_ROUTES.myTasks },
	{ key: "time", label: "Time", route: GLOBAL_ROUTES.time },
	{ key: "reports", label: "Reports", route: GLOBAL_ROUTES.reports },
	{ key: "extensions", label: "Extensions", route: GLOBAL_ROUTES.extensions },
	{ key: "workspaceSettings", label: "Workspace Settings", route: GLOBAL_ROUTES.workspaceSettings },
] as const;

/**
 * Ordered project-scoped navigation. Routes carry the `:projectId` param; the
 * web shell substitutes the active project id at render time.
 */
export const PROJECT_NAV: readonly NavEntryDef[] = [
	{ key: "overview", label: "Overview", route: PROJECT_ROUTE_PATTERNS.overview },
	{ key: "backlog", label: "Backlog", route: PROJECT_ROUTE_PATTERNS.backlog },
	{ key: "board", label: "Board", route: PROJECT_ROUTE_PATTERNS.board },
	{ key: "sprints", label: "Sprints", route: PROJECT_ROUTE_PATTERNS.sprints },
	{ key: "time", label: "Time", route: PROJECT_ROUTE_PATTERNS.time },
	{ key: "wiki", label: "Wiki", route: PROJECT_ROUTE_PATTERNS.wiki },
	{ key: "reports", label: "Reports", route: PROJECT_ROUTE_PATTERNS.reports },
	{ key: "settings", label: "Settings", route: PROJECT_ROUTE_PATTERNS.settings },
] as const;
