import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WorkItemPriority, WorkItemSource, WorkItemStatus } from "@tundra/domain";

import type { WorkItemView } from "../types.js";
import { WorkItemList, WorkItemRow } from "./WorkItemRow.js";

function makeItem(
	over: Partial<WorkItemView> & Pick<WorkItemView, "id" | "source" | "title">,
): WorkItemView {
	return {
		status: WorkItemStatus.Todo,
		priority: WorkItemPriority.Medium,
		projectKey: "TUN",
		projectName: "Tundra Core",
		...over,
	};
}

describe("WorkItemRow", () => {
	it("renders one identical row structure regardless of source (source-as-metadata)", () => {
		const sources = Object.values(WorkItemSource);
		const markups = sources.map((source) =>
			renderToStaticMarkup(<WorkItemRow item={makeItem({ id: source, source, title: "X" })} />),
		);
		// Every row uses the SAME structural classes — the layout never branches on
		// source; only the badge content differs.
		for (const html of markups) {
			expect(html).toContain("tnd-workitem-row__button");
			expect(html).toContain("tnd-workitem-row__main");
			expect(html).toContain("tnd-workitem-row__aside");
			expect(html).toContain("tnd-modulebadge");
		}
	});

	it("renders the row as a list item with a single button control", () => {
		const html = renderToStaticMarkup(
			<WorkItemRow
				item={makeItem({ id: "1", source: WorkItemSource.Task, title: "Wire it up" })}
			/>,
		);
		expect(html.startsWith("<li")).toBe(true);
		expect((html.match(/<button/g) ?? []).length).toBe(1);
		expect(html).toContain("Wire it up");
	});

	it("marks the selected row with aria-current", () => {
		const html = renderToStaticMarkup(
			<WorkItemRow item={makeItem({ id: "1", source: WorkItemSource.Bug, title: "Z" })} selected />,
		);
		expect(html).toContain('aria-current="true"');
	});

	it("renders translated source/status/priority via labels while keeping the data-source badge", () => {
		const html = renderToStaticMarkup(
			<WorkItemRow
				item={makeItem({
					id: "1",
					source: WorkItemSource.Bug,
					title: "Z",
					status: WorkItemStatus.Blocked,
					priority: WorkItemPriority.Urgent,
				})}
				labels={{
					source: () => "Fehler",
					status: () => "Blockiert",
					priority: () => "Dringend",
				}}
			/>,
		);
		// Translated enum text appears...
		expect(html).toContain("Fehler");
		expect(html).toContain("Blockiert");
		expect(html).toContain("Dringend");
		// ...while the English defaults do not.
		expect(html).not.toContain(">Bug<");
		expect(html).not.toContain("Blocked");
		expect(html).not.toContain("Urgent");
		// Source-as-metadata invariant: the badge still carries its data-source.
		expect(html).toContain('data-source="bug"');
	});
});

describe("WorkItemList", () => {
	it("renders a labeled list with one row per item", () => {
		const items = [
			makeItem({ id: "a", source: WorkItemSource.Task, title: "A" }),
			makeItem({ id: "b", source: WorkItemSource.Bug, title: "B" }),
		];
		const html = renderToStaticMarkup(<WorkItemList items={items} aria-label="My Tasks" />);
		expect(html).toContain('aria-label="My Tasks"');
		expect((html.match(/tnd-workitem-row__button/g) ?? []).length).toBe(2);
	});

	it("forwards labels to every row so source/status are translated list-wide", () => {
		const items = [
			makeItem({ id: "a", source: WorkItemSource.Task, title: "A", status: WorkItemStatus.Done }),
			makeItem({ id: "b", source: WorkItemSource.Bug, title: "B", status: WorkItemStatus.Done }),
		];
		const html = renderToStaticMarkup(
			<WorkItemList
				items={items}
				aria-label="My Tasks"
				labels={{
					status: () => "Erledigt",
					source: (s) => (s === WorkItemSource.Bug ? "Fehler" : "Aufgabe"),
				}}
			/>,
		);
		// Both rows pick up the translated status...
		expect((html.match(/Erledigt/g) ?? []).length).toBeGreaterThanOrEqual(2);
		// ...and the per-source translated badge label, with data-source intact.
		expect(html).toContain("Fehler");
		expect(html).toContain("Aufgabe");
		expect(html).toContain('data-source="bug"');
		expect(html).toContain('data-source="task"');
	});
});
