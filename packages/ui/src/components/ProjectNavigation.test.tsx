import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { GLOBAL_ROUTES, PROJECT_NAV } from "@tundra/domain";

import type { NavItem } from "../types.js";
import { ProjectNavigation, type ProjectNavigationProps } from "./ProjectNavigation.js";

/**
 * The separation invariant at the component contract level: ProjectNavigation
 * has NO slot/prop for global items, so it is structurally incapable of
 * rendering global routes. This test pins that contract.
 */
const projectItems: NavItem[] = PROJECT_NAV.filter((e) => e.key !== "settings").map((entry) => ({
	id: entry.key,
	label: entry.label,
	href: entry.route.replace(":projectId", "proj-1"),
}));

const settingsItem: NavItem = {
	id: "settings",
	label: "Settings",
	href: "/projects/proj-1/settings",
};

function render(extra?: Partial<ProjectNavigationProps>): string {
	return renderToStaticMarkup(
		<ProjectNavigation
			projectId="proj-1"
			items={projectItems}
			settingsItem={settingsItem}
			{...extra}
		/>,
	);
}

describe("ProjectNavigation", () => {
	it("is labeled as the Project nav landmark", () => {
		expect(render()).toContain('aria-label="Project"');
	});

	it("renders project entries (Backlog, Board) substituted with the active project id", () => {
		const html = render();
		expect(html).toContain("Backlog");
		expect(html).toContain("Board");
		expect(html).toContain("/projects/proj-1/backlog");
	});

	it("never renders any global route — it has no slot for global items", () => {
		const html = render();
		// Global routes are top-level paths (e.g. "/time"); project routes legitimately
		// END in the same segment ("/projects/proj-1/time"). The invariant is that no
		// GLOBAL href (an exact `href="/route"`) is ever emitted by the project nav.
		for (const route of Object.values(GLOBAL_ROUTES)) {
			expect(html).not.toContain(`href="${route}"`);
		}
		// No global-only labels leak in either.
		expect(html).not.toContain("My Tasks");
		expect(html).not.toContain("Workspace Settings");
		expect(html).not.toContain("Extensions");
	});

	it("has no prop to pass global items (compile-time contract)", () => {
		// @ts-expect-error globalItems is intentionally not part of the props.
		render({ globalItems: [{ id: "x", label: "Dashboard", href: "/dashboard" }] });
		expect(true).toBe(true);
	});
});
