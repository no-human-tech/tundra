import { expect, test, type Page } from "@playwright/test";

/**
 * UI-state coverage gaps found by a Playwright audit against the design
 * spec: loading skeletons, disabled affordances,
 * keyboard focus rings, live-ticking state, and live regrouping. Complements
 * the existing suites in apps/web/e2e/app.spec.ts — nothing here duplicates
 * that file's coverage.
 */

// A sample project id from apps/web/src/data (stable; see data/projects.ts).
const PROJECT_ID = "proj-core";

// The app defaults to Polish for a first-time visitor (design spec §3).
// These tests assert English copy/behavior, so seed it explicitly — same
// helper pattern as apps/web/e2e/app.spec.ts.
async function seedLanguage(page: Page, lang: "en" | "pl") {
	await page.addInitScript((value) => {
		if (!sessionStorage.getItem("__e2e_lang_seeded")) {
			localStorage.setItem("tundra_lang", value);
			sessionStorage.setItem("__e2e_lang_seeded", "1");
		}
	}, lang);
}

test.describe("Projects page — skeleton loading state on Refresh", () => {
	test("clicking Refresh shows shimmer skeleton cards, then resolves back to real project cards", async ({
		page,
	}) => {
		// Source: ProjectsPage in apps/web/src/pages/global/GlobalPages.tsx sets
		// `loading` true on Refresh and clears it after a real 1200ms
		// `window.setTimeout` — long enough to reliably observe in a real
		// browser, so no test hook or slowdown is needed.
		await seedLanguage(page, "en");
		await page.goto("/projects");
		await expect(page.getByRole("heading", { level: 1, name: "Projects" })).toBeVisible();

		const grid = page.locator(".tnd-grid--cards");
		await expect(grid).toHaveAttribute("aria-busy", "false");
		await expect(grid.locator(".tnd-card--interactive")).not.toHaveCount(0);

		await page.getByRole("button", { name: "Refresh" }).click();

		// Immediately after the click: skeleton placeholders are up, real cards
		// are gone, and the grid announces its busy state.
		await expect(grid).toHaveAttribute("aria-busy", "true");
		await expect(grid.locator(".tnd-skeleton").first()).toBeVisible();
		await expect(grid.locator(".tnd-card--interactive")).toHaveCount(0);

		// It resolves back to real content within the fixture's 1200ms window.
		await expect(grid).toHaveAttribute("aria-busy", "false", { timeout: 3000 });
		await expect(grid.locator(".tnd-skeleton")).toHaveCount(0);
		await expect(grid.locator(".tnd-card--interactive").first()).toBeVisible();
	});
});

test.describe("Project settings — required module toggle is disabled", () => {
	test("the Tasks Core module toggle is disabled and clicking it does not change its state", async ({
		page,
	}) => {
		await seedLanguage(page, "en");
		await page.goto(`/projects/${PROJECT_ID}/settings`);

		const tasksCard = page.locator(".tnd-modulecard", { hasText: "Tasks Core" });
		await expect(tasksCard).toBeVisible();

		const toggle = tasksCard.getByRole("switch");
		await expect(toggle).toBeDisabled();
		await expect(toggle).toHaveJSProperty("disabled", true);

		const opacityBefore = await toggle.evaluate((el) => getComputedStyle(el).opacity);
		expect(Number(opacityBefore)).toBeLessThan(1);

		const checkedBefore = await toggle.getAttribute("aria-checked");
		// `disabled` native buttons don't fire click handlers — force the click
		// to prove the app itself doesn't flip state, not just that the browser
		// swallowed the event.
		await toggle.click({ force: true });
		await expect(toggle).toHaveAttribute("aria-checked", checkedBefore ?? "true");
	});
});

test.describe("keyboard focus ring (design spec §8)", () => {
	test("tabbing to a nav link shows a visible mint focus outline", async ({ page }) => {
		await seedLanguage(page, "en");
		await page.goto("/dashboard");
		await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();

		// Tab through the page until a global-nav link is the focused element —
		// avoids hard-coding how many stops precede it (theme toggle, language
		// switcher, etc.).
		let focusedIsNavLink = false;
		for (let i = 0; i < 30 && !focusedIsNavLink; i++) {
			await page.keyboard.press("Tab");
			focusedIsNavLink = await page.evaluate(() => {
				const el = document.activeElement as HTMLElement | null;
				return Boolean(el?.classList.contains("tnd-nav__link"));
			});
		}
		expect(focusedIsNavLink).toBe(true);

		// Source: packages/ui/src/styles/global.css — `a:focus-visible` renders a
		// real CSS `outline` (mint-400, --tnd-focus-ring-color / -width tokens);
		// non-link controls instead use a box-shadow double-ring
		// (`--tnd-focus-ring`), so this check is scoped to a link element.
		const outline = await page.evaluate(() => {
			const el = document.activeElement as HTMLElement;
			const cs = getComputedStyle(el);
			return { style: cs.outlineStyle, width: cs.outlineWidth, color: cs.outlineColor };
		});
		expect(outline.style).toBe("solid");
		expect(outline.width).toBe("2px");
		expect(outline.color).toBe("rgb(20, 184, 143)"); // --tnd-color-mint-400 / #14B88F
	});
});

test.describe("Time screen — the live timer actually ticks", () => {
	test("the mono counter advances while running and holds steady once stopped", async ({
		page,
	}) => {
		await seedLanguage(page, "en");
		await page.goto(`/projects/${PROJECT_ID}/time`);
		// Project sub-pages keep a single document <h1> (the project context-bar
		// title); the screen's own heading is an <h2> — see ProjectScreen.tsx.
		await expect(page.getByRole("heading", { level: 2, name: "Time" })).toBeVisible();

		const display = page.locator(".tnd-timer__display");
		const toggleBtn = page.locator(".tnd-timer__button");

		// The fixture timer starts already running (design spec §7.10).
		await expect(toggleBtn).toHaveAttribute("data-running", "true");
		const readingA = await display.textContent();

		await page.waitForTimeout(2200);
		const readingB = await display.textContent();
		expect(readingB).not.toBe(readingA);

		// Stop it, then confirm the counter holds steady.
		await toggleBtn.click();
		await expect(toggleBtn).toHaveAttribute("data-running", "false");
		const readingC = await display.textContent();
		await page.waitForTimeout(1500);
		const readingD = await display.textContent();
		expect(readingD).toBe(readingC);
	});
});

test.describe("Board — live regrouping via the swimlane toggle", () => {
	test("switching grouping actually changes the board's DOM structure", async ({ page }) => {
		await seedLanguage(page, "en");
		await page.goto(`/projects/${PROJECT_ID}/board`);

		const groupGroup = page.getByRole("group", { name: "Swimlane grouping" });
		await expect(groupGroup).toBeVisible();

		// Default is "No swimlanes" — no swimlane row containers.
		await expect(groupGroup.getByRole("button", { name: "No swimlanes" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		await expect(page.locator(".tnd-swimlane")).toHaveCount(0);

		// Toggling to "By assignee" fans the same cards out into swimlane rows.
		await groupGroup.getByRole("button", { name: "By assignee" }).click();
		await expect(groupGroup.getByRole("button", { name: "By assignee" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		const laneCount = await page.locator(".tnd-swimlane").count();
		expect(laneCount).toBeGreaterThan(0);

		// Toggling back removes them again.
		await groupGroup.getByRole("button", { name: "No swimlanes" }).click();
		await expect(page.locator(".tnd-swimlane")).toHaveCount(0);
	});
});
