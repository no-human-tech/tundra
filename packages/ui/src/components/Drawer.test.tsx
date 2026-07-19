import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Drawer } from "./Drawer.js";

/**
 * The UI package tests run in node (no jsdom), so the focus-trap effect can't be
 * exercised here — that lives in apps/web's DOM tests. These pin the drawer's
 * accessible structure, which is what the focus management hangs off of.
 */
describe("Drawer", () => {
	it("renders nothing when closed", () => {
		const html = renderToStaticMarkup(
			<Drawer open={false} onClose={() => {}} title="Task">
				body
			</Drawer>,
		);
		expect(html).toBe("");
	});

	it("is a modal dialog labeled by its own title", () => {
		const html = renderToStaticMarkup(
			<Drawer open onClose={() => {}} title="Extension point: task drawer slots">
				body
			</Drawer>,
		);
		expect(html).toContain('role="dialog"');
		expect(html).toContain('aria-modal="true"');
		// aria-labelledby points at the rendered <h2> title id.
		const match = html.match(/aria-labelledby="([^"]+)"/);
		expect(match).not.toBeNull();
		const titleId = match![1];
		expect(html).toContain(`id="${titleId}"`);
		expect(html).toContain("Extension point: task drawer slots");
	});

	it("always renders a close affordance and a dismissable overlay", () => {
		const html = renderToStaticMarkup(
			<Drawer open onClose={() => {}} title="Task">
				body
			</Drawer>,
		);
		expect(html).toContain('aria-label="Close"');
		expect(html).toContain("tnd-drawer__overlay");
	});

	it("renders an optional tab bar and the body content", () => {
		const html = renderToStaticMarkup(
			<Drawer open onClose={() => {}} title="Task" tabs={<div>TABSLOT</div>}>
				<p>DRAWER BODY</p>
			</Drawer>,
		);
		expect(html).toContain("tnd-drawer__tabs");
		expect(html).toContain("TABSLOT");
		expect(html).toContain("DRAWER BODY");
	});
});
