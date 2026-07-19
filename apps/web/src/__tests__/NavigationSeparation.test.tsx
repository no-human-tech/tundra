import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GLOBAL_ROUTES, PROJECT_ROUTE_PATTERNS } from "@tundra/domain";

import { App } from "../App.js";
import { renderAtPath } from "./testRouter.js";

const projectId = "proj-core";

describe("navigation separation (the hard invariant)", () => {
	it("on a global route, only the Global nav is present (no Project nav)", async () => {
		await renderAtPath("/my-tasks", <App />);
		expect(screen.getByRole("navigation", { name: "Global" })).toBeInTheDocument();
		expect(screen.queryByRole("navigation", { name: "Project" })).not.toBeInTheDocument();
	});

	it("on a project route, BOTH navs are present and distinctly labeled", async () => {
		await renderAtPath(`/projects/${projectId}/board`, <App />);
		expect(screen.getByRole("navigation", { name: "Global" })).toBeInTheDocument();
		expect(screen.getByRole("navigation", { name: "Project" })).toBeInTheDocument();
	});

	it("the Project nav never renders a global route href", async () => {
		await renderAtPath(`/projects/${projectId}/board`, <App />);
		const projectNav = screen.getByRole("navigation", { name: "Project" });
		const links = within(projectNav).getAllByRole("link");
		const hrefs = links.map((a) => a.getAttribute("href") ?? "");

		// Every project-nav link is project-scoped; none equals a global route.
		const globalRoutes = new Set<string>(Object.values(GLOBAL_ROUTES));
		for (const href of hrefs) {
			expect(globalRoutes.has(href)).toBe(false);
			expect(href.startsWith(`/projects/${projectId}/`)).toBe(true);
		}
	});

	it("the Global nav never renders a project-scoped route href", async () => {
		await renderAtPath(`/projects/${projectId}/board`, <App />);
		const globalNav = screen.getByRole("navigation", { name: "Global" });
		const links = within(globalNav).getAllByRole("link");
		const hrefs = links.map((a) => a.getAttribute("href") ?? "");

		const projectScoped = /^\/projects\/[^/]+\//;
		for (const href of hrefs) {
			expect(projectScoped.test(href)).toBe(false);
		}
		// Sanity: the global nav still shows its own entries.
		expect(within(globalNav).getByText("My Tasks")).toBeInTheDocument();
	});

	it("the Project nav exposes all nine project entries (overview..settings)", async () => {
		await renderAtPath(`/projects/${projectId}/overview`, <App />);
		const projectNav = screen.getByRole("navigation", { name: "Project" });
		const links = within(projectNav).getAllByRole("link");
		expect(links).toHaveLength(Object.keys(PROJECT_ROUTE_PATTERNS).length);
	});
});
