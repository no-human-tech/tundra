import { describe, expect, it } from "vitest";

import {
	GLOBAL_NAV,
	GLOBAL_ROUTES,
	PROJECT_NAV,
	PROJECT_ROUTE_PATTERNS,
	assertNavScope,
	navScopeOf,
} from "./navigation.js";

describe("navScopeOf", () => {
	it("classifies every GLOBAL_ROUTE as global", () => {
		for (const route of Object.values(GLOBAL_ROUTES)) {
			expect(navScopeOf(route)).toBe("global");
		}
	});

	it("classifies every PROJECT_ROUTE_PATTERN as project", () => {
		for (const route of Object.values(PROJECT_ROUTE_PATTERNS)) {
			expect(navScopeOf(route)).toBe("project");
		}
	});

	it("treats the /projects list itself as global, not project", () => {
		expect(navScopeOf("/projects")).toBe("global");
		expect(navScopeOf("/projects/:projectId/overview")).toBe("project");
	});
});

describe("assertNavScope", () => {
	it("accepts routes matching their declared scope", () => {
		expect(() => assertNavScope(GLOBAL_ROUTES.dashboard, "global")).not.toThrow();
		expect(() => assertNavScope(PROJECT_ROUTE_PATTERNS.board, "project")).not.toThrow();
	});

	it("throws when a project route is declared global", () => {
		expect(() => assertNavScope(PROJECT_ROUTE_PATTERNS.board, "global")).toThrow(
			/Nav scope violation/,
		);
	});

	it("throws when a global route is declared project", () => {
		expect(() => assertNavScope(GLOBAL_ROUTES.dashboard, "project")).toThrow(/Nav scope violation/);
	});
});

describe("nav lists", () => {
	it("GLOBAL_NAV entries are all global-scoped and unique by key", () => {
		const keys = new Set(GLOBAL_NAV.map((e) => e.key));
		expect(keys.size).toBe(GLOBAL_NAV.length);
		for (const entry of GLOBAL_NAV) {
			expect(navScopeOf(entry.route)).toBe("global");
		}
	});

	it("PROJECT_NAV entries are all project-scoped and unique by key", () => {
		const keys = new Set(PROJECT_NAV.map((e) => e.key));
		expect(keys.size).toBe(PROJECT_NAV.length);
		for (const entry of PROJECT_NAV) {
			expect(navScopeOf(entry.route)).toBe("project");
		}
	});

	it("has the expected counts (7 global, 8 project)", () => {
		expect(GLOBAL_NAV.length).toBe(7);
		// Overview, Backlog, Board, Sprints, Time, Wiki, Reports, Settings —
		// Discussions was withdrawn (the design spec §6).
		expect(PROJECT_NAV.length).toBe(8);
	});
});
