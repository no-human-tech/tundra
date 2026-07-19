import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WorkItemSource } from "@tundra/domain";

import { ModuleBadge, SOURCE_BADGE_MAP } from "./ModuleBadge.js";

/**
 * UI package tests run in the default (node) vitest environment — no jsdom is
 * available here — so we assert on static markup. Full DOM/interaction tests
 * live in apps/web where jsdom + Testing Library are installed.
 */
describe("ModuleBadge", () => {
	it("renders a visible text label for every source (meaning is never color-only)", () => {
		for (const source of Object.values(WorkItemSource)) {
			const html = renderToStaticMarkup(<ModuleBadge source={source} />);
			expect(html).toContain(SOURCE_BADGE_MAP[source].label);
			// color/origin is carried via data-source for centralized styling, in
			// ADDITION to the text label — not instead of it.
			expect(html).toContain(`data-source="${source}"`);
		}
	});

	it("uses the module label for extension sources", () => {
		const html = renderToStaticMarkup(
			<ModuleBadge source={WorkItemSource.Extension} moduleLabel="Helpdesk" />,
		);
		expect(html).toContain("Helpdesk");
		expect(html).toContain('data-source="extension"');
	});

	it("uses the module label for automation sources", () => {
		const html = renderToStaticMarkup(
			<ModuleBadge source={WorkItemSource.Automation} moduleLabel="Stale-ticket bot" />,
		);
		expect(html).toContain("Stale-ticket bot");
	});

	it("falls back to the default label when no module label is given", () => {
		const html = renderToStaticMarkup(<ModuleBadge source={WorkItemSource.Bug} />);
		expect(html).toContain("Bug");
	});

	it("marks the icon as decorative (aria-hidden) so it is not announced", () => {
		const html = renderToStaticMarkup(<ModuleBadge source={WorkItemSource.Task} />);
		expect(html).toContain('aria-hidden="true"');
	});

	it("renders an overridden (translated) label while keeping data-source unchanged", () => {
		// A translated label must replace the visible text without changing the
		// source-as-metadata invariant (data-source drives the centralized styling).
		const html = renderToStaticMarkup(<ModuleBadge source={WorkItemSource.Bug} label="Fehler" />);
		expect(html).toContain("Fehler");
		expect(html).not.toContain(">Bug<");
		// color/icon mapping is untouched.
		expect(html).toContain('data-source="bug"');
	});
});
