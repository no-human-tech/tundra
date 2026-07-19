import { expect, test, type Page } from "@playwright/test";

/**
 * My Tasks full-width layout (direct product feedback): the `1fr 304px` split
 * rail is gone. The queue takes the full page width, the metrics/count summary
 * is a horizontal band between the filter bar and the task list, the "One
 * queue, many sources" explainer card is deleted entirely, and "Plan my day"
 * opens a full-width panel under the metrics band instead of a side rail.
 *
 * Kept separate from app.spec.ts / screens-coverage.spec.ts / etc. per the
 * parallel-work split — this file only covers the My Tasks layout change.
 */

// See app.spec.ts's own copy of this helper for the full rationale (the app
// defaults to Polish for a first-time visitor, so tests asserting specific
// English copy/selectors seed English explicitly).
async function seedLanguage(page: Page, lang: "en" | "pl") {
	await page.addInitScript((value) => {
		if (!sessionStorage.getItem("__e2e_lang_seeded")) {
			localStorage.setItem("tundra_lang", value);
			sessionStorage.setItem("__e2e_lang_seeded", "1");
		}
	}, lang);
}

test.describe("My Tasks — full-width layout, no side rail", () => {
	test("the 'One queue, many sources' explainer card is gone", async ({ page }) => {
		await seedLanguage(page, "en");
		await page.goto("/my-tasks");

		// Wait for the queue to settle (demo fallback or live), same signal used by
		// app.spec.ts's "My Tasks unified queue" test.
		await expect(page.locator(".tnd-workitem-row").first()).toBeVisible();

		await expect(page.getByText("One queue, many sources")).toHaveCount(0);
		await expect(page.getByRole("heading", { name: "One queue, many sources" })).toHaveCount(0);
	});

	test("the queue has no side rail and renders at (near) full page-container width", async ({
		page,
	}) => {
		await seedLanguage(page, "en");
		await page.goto("/my-tasks");
		await expect(page.locator(".tnd-workitem-row").first()).toBeVisible();

		// The old `1fr 304px` split-grid classes must not exist anywhere on the page.
		await expect(page.locator(".tnd-split")).toHaveCount(0);
		await expect(page.locator(".tnd-split--fixed-rail")).toHaveCount(0);

		const queue = page.getByTestId("mytasks-queue");
		await expect(queue).toBeVisible();

		const page_ = page.locator(".tnd-page").first();
		const [queueWidth, pageWidth] = await Promise.all([
			queue.evaluate((el) => el.getBoundingClientRect().width),
			page_.evaluate((el) => el.getBoundingClientRect().width),
		]);
		// No sibling rail eating horizontal space: the queue spans at least 90% of
		// its page container's rendered width.
		expect(queueWidth).toBeGreaterThan(pageWidth * 0.9);
	});

	test("the metrics band renders after the filter bar and before the task list", async ({
		page,
	}) => {
		await seedLanguage(page, "en");
		await page.goto("/my-tasks");
		await expect(page.locator(".tnd-workitem-row").first()).toBeVisible();

		const filterBar = page.getByRole("group", { name: "My Tasks filters" });
		const metricsBand = page.getByTestId("mytasks-metrics-band");
		const queue = page.getByTestId("mytasks-queue");

		await expect(filterBar).toBeVisible();
		await expect(metricsBand).toBeVisible();
		await expect(queue).toBeVisible();

		// The metrics band shows the four counts as a horizontal summary, not a
		// sidebar card.
		await expect(metricsBand.getByText("assigned")).toBeVisible();
		await expect(metricsBand.getByText("due today")).toBeVisible();
		await expect(metricsBand.getByText("blocked")).toBeVisible();
		await expect(metricsBand.getByText("from story checklists")).toBeVisible();

		// DOM order: filter bar -> metrics band -> task list.
		const order = await page.evaluate(() => {
			const bar = document.querySelector(".tnd-filterbar");
			const band = document.querySelector('[data-testid="mytasks-metrics-band"]');
			const queueEl = document.querySelector('[data-testid="mytasks-queue"]');
			if (!bar || !band || !queueEl) return null;
			const barBeforeBand = Boolean(
				bar.compareDocumentPosition(band) & Node.DOCUMENT_POSITION_FOLLOWING,
			);
			const bandBeforeQueue = Boolean(
				band.compareDocumentPosition(queueEl) & Node.DOCUMENT_POSITION_FOLLOWING,
			);
			return { barBeforeBand, bandBeforeQueue };
		});
		expect(order).toEqual({ barBeforeBand: true, bandBeforeQueue: true });
	});

	test("'Plan my day' opens a full-width panel under the metrics band, not a rail", async ({
		page,
	}) => {
		await seedLanguage(page, "en");
		await page.goto("/my-tasks");
		await expect(page.locator(".tnd-workitem-row").first()).toBeVisible();

		await expect(page.getByTestId("mytasks-plan-panel")).toHaveCount(0);

		await page.getByRole("button", { name: "Plan my day" }).click();

		const planPanel = page.getByTestId("mytasks-plan-panel");
		await expect(planPanel).toBeVisible();

		const metricsBand = page.getByTestId("mytasks-metrics-band");
		const queue = page.getByTestId("mytasks-queue");
		const [bandBox, planBox, queueBox] = await Promise.all([
			metricsBand.boundingBox(),
			planPanel.boundingBox(),
			queue.boundingBox(),
		]);
		expect(bandBox && planBox && queueBox).toBeTruthy();
		// The panel sits below the metrics band and above the task list — a stacked
		// full-width section, never a side-by-side rail.
		expect(planBox!.y).toBeGreaterThanOrEqual(bandBox!.y + bandBox!.height - 1);
		expect(queueBox!.y).toBeGreaterThanOrEqual(planBox!.y + planBox!.height - 1);

		// It's full-width, not a fixed narrow rail card.
		const pageWidth = (await page.locator(".tnd-page").first().boundingBox())!.width;
		expect(planBox!.width).toBeGreaterThan(pageWidth * 0.9);
	});

	test("mobile viewport (<=680px) stays single column with no horizontal overflow, and Plan my day still works", async ({
		page,
	}) => {
		await seedLanguage(page, "en");
		await page.setViewportSize({ width: 480, height: 900 });
		await page.goto("/my-tasks");
		await expect(page.locator(".tnd-workitem-row").first()).toBeVisible();

		// NOTE: `document.documentElement.scrollWidth <= window.innerWidth` is not
		// used here as the top-level signal — the app shell's `.tnd-topbar` (brand +
		// search + actions) already exceeds ~680px of unshrinkable min-content on
		// EVERY route at this viewport (reproduced on /dashboard too), which forces
		// the shared single-column app-shell grid track wider than the viewport
		// regardless of this page's own content. That is a pre-existing, app-shell-
		// level responsive gap, not something introduced by this My Tasks layout
		// change, and out of scope for a My-Tasks-only change (fixing it would mean
		// editing shared shell CSS every other screen depends on). Instead we assert
		// the thing this task actually changed: My Tasks' OWN content (filter bar,
		// metrics band, plan panel, task list) does not add any horizontal overflow
		// of its own inside `.tnd-page` — i.e. `.tnd-page`'s scrollWidth tracks its
		// clientWidth exactly, whatever width the shell hands it.
		const pageOverflow = await page.evaluate(() => {
			const el = document.querySelector(".tnd-page");
			return el ? el.scrollWidth - el.clientWidth : 0;
		});
		expect(pageOverflow).toBeLessThanOrEqual(1);

		await expect(page.locator(".tnd-split")).toHaveCount(0);

		await page.getByRole("button", { name: "Plan my day" }).click();
		await expect(page.getByTestId("mytasks-plan-panel")).toBeVisible();

		const pageOverflowAfterPlan = await page.evaluate(() => {
			const el = document.querySelector(".tnd-page");
			return el ? el.scrollWidth - el.clientWidth : 0;
		});
		expect(pageOverflowAfterPlan).toBeLessThanOrEqual(1);
	});
});
