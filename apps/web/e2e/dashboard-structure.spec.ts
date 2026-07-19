import { expect, test, type Page } from "@playwright/test";

/**
 * Dashboard structural checks against the canonical prototype geometry
 * (the design prototype's `isDashboard` block): the LEFT
 * column cards (work queue, active projects, module activity) and RIGHT
 * column cards (my open tasks, time logged this week, recent comments) must
 * render in that exact order, the stat strip must have 4 cards, and the
 * "New project" CTA must be the orange accent button that opens the New
 * Project modal (never a navigation to Extensions or anywhere else).
 *
 * Kept in its own file per the parallel-work split — this file only covers
 * dashboard structure and does not touch app.spec.ts / screens-coverage /
 * states-coverage / pixel-audit / language-selector-style /
 * mytasks-fullwidth / new-project-modal.
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

const ORANGE_ACCENT_RGB = "rgb(255, 138, 61)"; // #FF8A3D

test.describe("Dashboard structure (canonical comp geometry)", () => {
	test("stat strip renders exactly 4 cards", async ({ page }) => {
		await seedLanguage(page, "en");
		await page.goto("/dashboard");
		await page.getByRole("heading", { level: 1, name: "Dashboard" }).waitFor();

		const stats = page.locator(".tnd-grid--metrics > *");
		await expect(stats).toHaveCount(4);
	});

	test("left column cards render in order: work queue, active projects, module activity", async ({
		page,
	}) => {
		await seedLanguage(page, "en");
		await page.goto("/dashboard");
		await page.getByRole("heading", { level: 1, name: "Dashboard" }).waitFor();

		const leftColumn = page.locator(".tnd-split--dashboard > div").first();
		const titles = await leftColumn.locator(".tnd-section__title").allTextContents();
		expect(titles).toEqual(["My work queue", "Active projects", "Module activity"]);
	});

	test("right column cards render in order: my open tasks, time logged this week, recent comments", async ({
		page,
	}) => {
		await seedLanguage(page, "en");
		await page.goto("/dashboard");
		await page.getByRole("heading", { level: 1, name: "Dashboard" }).waitFor();

		const rightColumn = page.locator(".tnd-split--dashboard > div").nth(1);
		const titles = await rightColumn.locator(".tnd-section__title").allTextContents();
		expect(titles).toEqual(["My open tasks", "Time logged this week", "Recent comments"]);
	});

	test("the 'How Tundra fits together' card stays outside the two-column layout", async ({
		page,
	}) => {
		await seedLanguage(page, "en");
		await page.goto("/dashboard");
		await page.getByRole("heading", { level: 1, name: "Dashboard" }).waitFor();

		// Present on the page (content preserved)...
		await expect(page.getByText("How Tundra fits together")).toBeVisible();
		// ...but not one of the 3+3 dashboard column cards.
		const rightColumn = page.locator(".tnd-split--dashboard > div").nth(1);
		const titles = await rightColumn.locator(".tnd-section__title").allTextContents();
		expect(titles).not.toContain("How Tundra fits together");
		const leftColumn = page.locator(".tnd-split--dashboard > div").first();
		const leftTitles = await leftColumn.locator(".tnd-section__title").allTextContents();
		expect(leftTitles).not.toContain("How Tundra fits together");
	});

	test("the 'New project' CTA is the orange accent button", async ({ page }) => {
		await seedLanguage(page, "en");
		await page.goto("/dashboard");
		await page.getByRole("heading", { level: 1, name: "Dashboard" }).waitFor();

		const cta = page.getByRole("button", { name: "New project" }).last();
		await expect(cta).toBeVisible();
		const bg = await cta.evaluate((el) => getComputedStyle(el).backgroundColor);
		expect(bg).toBe(ORANGE_ACCENT_RGB);
	});

	test("clicking the 'New project' CTA opens the New Project modal (not Extensions)", async ({
		page,
	}) => {
		await seedLanguage(page, "en");
		await page.goto("/dashboard");
		await page.getByRole("heading", { level: 1, name: "Dashboard" }).waitFor();

		await page.getByRole("button", { name: "New project" }).last().click();

		await expect(page.getByRole("dialog", { name: "New project" })).toBeVisible();
		// Must not have navigated to /extensions.
		await expect(page).toHaveURL(/\/dashboard$/);
	});
});
