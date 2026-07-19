/**
 * CI-GATED INVARIANT: navigation separation (global vs project).
 *
 * Tundra has a hard product rule (CLAUDE.md "Main principles"): global navigation
 * and project navigation must stay separate — never blend global concerns into a
 * project-scoped menu or vice versa. This file is one of the two non-negotiable,
 * CI-gated invariant suites. It must always pass; a failure here means a real
 * product-rule violation, not a flaky test.
 *
 * It is intentionally exhaustive: it iterates EVERY entry in `GLOBAL_NAV` and
 * `PROJECT_NAV` (and the underlying route constants) rather than spot-checking,
 * so adding a mis-scoped route to either list breaks the build.
 *
 * Companion invariant: `packages/test-utils/src/aggregation-invariant.test.ts`.
 */

import { describe, expect, it } from "vitest";

import {
	GLOBAL_NAV,
	GLOBAL_ROUTES,
	PROJECT_NAV,
	PROJECT_ROUTE_PATTERNS,
	assertNavScope,
	navScopeOf,
} from "./navigation.js";

describe("INVARIANT: navigation separation (global vs project)", () => {
	it("every GLOBAL_NAV route resolves to navScopeOf() === 'global' (all entries)", () => {
		expect(GLOBAL_NAV.length).toBeGreaterThan(0);
		for (const entry of GLOBAL_NAV) {
			expect(navScopeOf(entry.route), `${entry.key} -> ${entry.route}`).toBe("global");
		}
	});

	it("every PROJECT_NAV route resolves to navScopeOf() === 'project' (all entries)", () => {
		expect(PROJECT_NAV.length).toBeGreaterThan(0);
		for (const entry of PROJECT_NAV) {
			expect(navScopeOf(entry.route), `${entry.key} -> ${entry.route}`).toBe("project");
		}
	});

	it("the two nav lists are disjoint: no route appears in both", () => {
		const globalRoutes = new Set(GLOBAL_NAV.map((e) => e.route));
		const projectRoutes = new Set(PROJECT_NAV.map((e) => e.route));

		for (const route of globalRoutes) {
			expect(projectRoutes.has(route), `global route leaked into PROJECT_NAV: ${route}`).toBe(
				false,
			);
		}
		for (const route of projectRoutes) {
			expect(globalRoutes.has(route), `project route leaked into GLOBAL_NAV: ${route}`).toBe(false);
		}

		// Cross-check against the canonical route constants too, not just the lists.
		for (const route of Object.values(GLOBAL_ROUTES)) {
			expect(
				projectRoutes.has(route),
				`GLOBAL_ROUTES value leaked into PROJECT_NAV: ${route}`,
			).toBe(false);
		}
		for (const route of Object.values(PROJECT_ROUTE_PATTERNS)) {
			expect(
				globalRoutes.has(route),
				`PROJECT_ROUTE_PATTERNS value leaked into GLOBAL_NAV: ${route}`,
			).toBe(false);
		}
	});

	it("assertNavScope throws when a global route is declared 'project' (every GLOBAL_NAV entry)", () => {
		for (const entry of GLOBAL_NAV) {
			expect(
				() => assertNavScope(entry.route, "project"),
				`${entry.key} (${entry.route}) was accepted as project-scoped`,
			).toThrow(/Nav scope violation/);
		}
	});

	it("assertNavScope throws when a project route is declared 'global' (every PROJECT_NAV entry)", () => {
		for (const entry of PROJECT_NAV) {
			expect(
				() => assertNavScope(entry.route, "global"),
				`${entry.key} (${entry.route}) was accepted as global-scoped`,
			).toThrow(/Nav scope violation/);
		}
	});

	it("assertNavScope does NOT throw for correctly-scoped pairings (every entry, both lists)", () => {
		for (const entry of GLOBAL_NAV) {
			expect(
				() => assertNavScope(entry.route, "global"),
				`${entry.key} (${entry.route}) was rejected as global-scoped`,
			).not.toThrow();
		}
		for (const entry of PROJECT_NAV) {
			expect(
				() => assertNavScope(entry.route, "project"),
				`${entry.key} (${entry.route}) was rejected as project-scoped`,
			).not.toThrow();
		}
	});
});
