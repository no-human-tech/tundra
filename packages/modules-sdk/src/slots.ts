/**
 * The closed initial set of named extension-point slots (architect report §4).
 *
 * Slots are the string identifiers a module references in its manifest's
 * `contributes[].slot`. The registry indexes contributions by slot and renders /
 * invokes them per slot.
 */

import type { ExtensionPoint, NavScope } from "@tundra/domain";
import { navScopeOf } from "@tundra/domain";

export const SLOTS = {
	globalNav: "global.nav",
	projectNav: "project.nav",
	dashboardWidgets: "dashboard.widgets",
	workitemDrawer: "workitem.drawer",
	projectSettings: "project.settings",
	workspaceSettings: "workspace.settings",
	workitemProviders: "workitem.providers",
	permissionHooks: "permission.hooks",
} as const;

export type SlotName = (typeof SLOTS)[keyof typeof SLOTS];

/** The two nav slots and the route scope each requires. */
export const NAV_SLOT_SCOPE: Readonly<Record<string, NavScope>> = {
	[SLOTS.globalNav]: "global",
	[SLOTS.projectNav]: "project",
};

/**
 * A nav contribution carries the route the module wants to link to. The host
 * validates that route's scope against the nav slot at registration time.
 *
 * This refines the base `ExtensionPoint` (which has no route) for nav slots.
 */
export interface NavExtensionPoint extends ExtensionPoint {
	slot: typeof SLOTS.globalNav | typeof SLOTS.projectNav;
	/** Route pattern the nav entry links to, e.g. "/projects/:projectId/board". */
	route: string;
	/** Visible label for the nav entry. */
	label: string;
}

/** Type guard: does this contribution target one of the two nav slots? */
export function isNavContribution(point: ExtensionPoint): point is NavExtensionPoint {
	return point.slot === SLOTS.globalNav || point.slot === SLOTS.projectNav;
}

/** True when a nav contribution's route matches the scope its slot requires. */
export function navContributionScopeMatches(point: NavExtensionPoint): boolean {
	const required = NAV_SLOT_SCOPE[point.slot];
	return required !== undefined && navScopeOf(point.route) === required;
}
