import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { myTasksEntries, myTasksGroups } from "../data/index.js";
import { MyTasksPage } from "../pages/MyTasksPage.js";
import { renderAtPath as renderAt } from "./testRouter.js";

/**
 * In jsdom there is no reachable GraphQL API (fetch is undefined / rejects), so
 * `MyTasksPage` fetches on mount, fails fast, and falls back to the bundled demo
 * fixtures with a visible "Demo data — API unavailable" marker. Every assertion
 * below is against that demo-fallback render, awaited via `findBy*`.
 */
describe("My Tasks (unified queue, demo fallback)", () => {
	it("falls back to demo data with a visible marker when the API is unreachable", async () => {
		await renderAt("/my-tasks", <MyTasksPage />);

		// The fallback is loud and never color-only: the marker text is present.
		expect(await screen.findByText(/Demo data — API unavailable/)).toBeInTheDocument();
	});

	it("renders every queue item with the SAME row component across grouped lists", async () => {
		await renderAt("/my-tasks", <MyTasksPage />);

		// Await the demo-fallback render (the first group's list appears once the
		// mount fetch rejects).
		await screen.findByRole("list", { name: myTasksGroups[0]!.name });

		// The queue is grouped into multiple labelled lists (Today / Upcoming /
		// Blocked / No due date / Done recently). Across ALL of them, the total
		// number of work-item rows equals the number of queue entries — one row per
		// item, the single-layout invariant.
		let totalRows = 0;
		for (const group of myTasksGroups) {
			const list = screen.getByRole("list", { name: group.name });
			const rows = within(list).getAllByRole("listitem");
			expect(rows).toHaveLength(group.entries.length);
			// Each row exposes exactly one interactive control (the open button) — the
			// structure does not change per source.
			for (const row of rows) {
				expect(within(row).getAllByRole("button")).toHaveLength(1);
			}
			totalRows += rows.length;
		}
		expect(totalRows).toBe(myTasksEntries.length);
	});

	it("shows the source types as badge metadata (label visible, not color-only)", async () => {
		await renderAt("/my-tasks", <MyTasksPage />);
		await screen.findByRole("list", { name: myTasksGroups[0]!.name });

		// Default source labels appear as text (source is metadata, not a layout).
		expect(screen.getAllByText("Task").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Story item").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Bug").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Review").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Docs").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Subtask").length).toBeGreaterThan(0);
		// The demo fixtures' Automation-sourced item carries a contributing
		// `moduleLabel` ("Automations"), same rule as Extension below.
		expect(screen.getAllByText("Automations").length).toBeGreaterThan(0);
		// Extension source uses the contributing module's label.
		expect(screen.getByText("GitHub")).toBeInTheDocument();
	});

	it("renders each queue item title", async () => {
		await renderAt("/my-tasks", <MyTasksPage />);
		await screen.findByRole("list", { name: myTasksGroups[0]!.name });
		for (const entry of myTasksEntries) {
			expect(screen.getAllByText(entry.item.title).length).toBeGreaterThan(0);
		}
	});

	it("exposes the four header metrics as a band above the task list, with no explainer card", async () => {
		await renderAt("/my-tasks", <MyTasksPage />);
		await screen.findByRole("list", { name: myTasksGroups[0]!.name });
		expect(screen.getByText("assigned")).toBeInTheDocument();
		expect(screen.getByText("due today")).toBeInTheDocument();
		expect(screen.getByText("blocked")).toBeInTheDocument();
		expect(screen.getByText("from story checklists")).toBeInTheDocument();
		// The "One queue, many sources" explainer card was removed entirely
		// (layout-only change per direct product feedback: full-width queue, no rail).
		expect(screen.queryByText("One queue, many sources")).not.toBeInTheDocument();
	});

	it("renders the task list at full page width, with no side rail", async () => {
		await renderAt("/my-tasks", <MyTasksPage />);
		await screen.findByRole("list", { name: myTasksGroups[0]!.name });
		// The old `1fr 304px` split rail is gone; the split-grid class must not appear
		// anywhere on the page.
		expect(document.querySelector(".tnd-split")).not.toBeInTheDocument();
		expect(document.querySelector(".tnd-split--fixed-rail")).not.toBeInTheDocument();
	});

	it("shows the Plan my day panel full-width under the metrics band, not in a rail", async () => {
		await renderAt("/my-tasks", <MyTasksPage />);
		await screen.findByRole("list", { name: myTasksGroups[0]!.name });

		expect(screen.queryByTestId("mytasks-plan-panel")).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "Plan my day" }));

		const metricsBand = await screen.findByTestId("mytasks-metrics-band");
		const planPanel = await screen.findByTestId("mytasks-plan-panel");
		expect(planPanel).toBeInTheDocument();
		// DOM order: metrics band, then the plan panel, both before the task list.
		expect(
			metricsBand.compareDocumentPosition(planPanel) & Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
	});
});
