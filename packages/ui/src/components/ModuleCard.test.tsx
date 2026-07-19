import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Icon } from "../primitives/Icon.js";
import { ModuleCard, type ModuleStatus } from "./ModuleCard.js";

/**
 * UI package tests run in the default (node) vitest environment — no jsdom — so
 * we assert on static markup. Interaction tests live in apps/web.
 */
describe("ModuleCard", () => {
	it("renders each status as a visible text label (never color-only)", () => {
		const statuses: ModuleStatus[] = ["Installed", "Enabled", "Disabled", "Experimental"];
		for (const status of statuses) {
			const html = renderToStaticMarkup(
				<ModuleCard name="Kanban Board" status={status} meta="Workflow · v2.4.0" />,
			);
			expect(html).toContain(status);
			expect(html).toContain("Kanban Board");
			expect(html).toContain("tnd-badge");
		}
	});

	it("maps the icon tile status via data-status", () => {
		const html = renderToStaticMarkup(
			<ModuleCard name="Automations" status="Experimental" icon={<Icon name="bolt" />} />,
		);
		expect(html).toContain('data-status="experimental"');
	});

	it("renders an accessible toggle that states what it switches", () => {
		const html = renderToStaticMarkup(<ModuleCard name="Docs" status="Enabled" enabled={true} />);
		expect(html).toContain('role="switch"');
		expect(html).toContain('aria-checked="true"');
		// The toggle's accessible name names the module + the action.
		expect(html).toContain("Disable Docs");
	});

	it("omits the toggle when `enabled` is not provided", () => {
		const html = renderToStaticMarkup(<ModuleCard name="GitHub" status="Installed" />);
		expect(html).not.toContain('role="switch"');
	});

	it("renders a disabled toggle for required/locked modules", () => {
		const html = renderToStaticMarkup(
			<ModuleCard name="Tasks Core" status="Installed" enabled={true} toggleDisabled />,
		);
		expect(html).toContain('role="switch"');
		expect(html).toContain("disabled");
	});
});
