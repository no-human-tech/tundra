import { expect, test, type Page } from "@playwright/test";

/**
 * Computed-style regression coverage for the language selector's surface
 * background — it must always render the design-system surface color, never
 * a native/OS-default grey `<select>` background, in both themes and on
 * every surface it appears on: the app Topbar (`/dashboard`) and the auth
 * header (`/login#login`) both mount the SAME component,
 * `apps/web/src/components/LanguageSwitcher.tsx` — a native
 * `<select class="tnd-langswitcher">`, styled via
 * `apps/web/src/styles/app.css` (appearance:none + token-based bg/border/
 * color, since native select chrome can't be restyled directly).
 *
 * Expected literal colors: light surface #ffffff, dark surface #112a24 —
 * see packages/ui/src/styles/tokens.css.
 *
 * Theme is seeded via `tundra_theme` before navigation: the anti-FOUC inline
 * script in apps/web/index.html reads it and sets `<html data-theme>` before
 * first paint — see packages/ui/src/theme/themeController.ts `getTheme()`.
 */

const LIGHT_SURFACE_RGB = "rgb(255, 255, 255)"; // #ffffff
const DARK_SURFACE_RGB = "rgb(17, 42, 36)"; // #112a24

async function seedTheme(page: Page, theme: "light" | "dark") {
	await page.addInitScript((value) => {
		localStorage.setItem("tundra_theme", value);
	}, theme);
}

test.describe("language selector — surface background matches the design system", () => {
	test("dashboard topbar: native select bg is white in light theme, not native grey", async ({
		page,
	}) => {
		await seedTheme(page, "light");
		await page.goto("/dashboard");
		const select = page.locator("select.tnd-langswitcher");
		await expect(select).toBeVisible({ timeout: 15_000 });
		const bg = await select.evaluate((el) => getComputedStyle(el).backgroundColor);
		expect(bg).toBe(LIGHT_SURFACE_RGB);
		const appearance = await select.evaluate((el) => getComputedStyle(el).appearance);
		expect(appearance).toBe("none");
	});

	test("dashboard topbar: native select bg matches the dark surface token in dark theme", async ({
		page,
	}) => {
		await seedTheme(page, "dark");
		await page.goto("/dashboard");
		await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
		const select = page.locator("select.tnd-langswitcher");
		await expect(select).toBeVisible({ timeout: 15_000 });
		const bg = await select.evaluate((el) => getComputedStyle(el).backgroundColor);
		expect(bg).toBe(DARK_SURFACE_RGB);
		// Text must stay legible against the dark surface (dark-theme ink token).
		const color = await select.evaluate((el) => getComputedStyle(el).color);
		expect(color).toBe("rgb(234, 246, 241)"); // --tnd-color-text dark: #eaf6f1
	});

	test("auth header (/login#login): same LanguageSwitcher component, same light-theme bg", async ({
		page,
	}) => {
		await seedTheme(page, "light");
		await page.goto("/login#login");
		const select = page.locator("select.tnd-langswitcher");
		await expect(select).toBeVisible({ timeout: 15_000 });
		const bg = await select.evaluate((el) => getComputedStyle(el).backgroundColor);
		expect(bg).toBe(LIGHT_SURFACE_RGB);
	});

	test("auth header (/login#login): same LanguageSwitcher component, same dark-theme bg", async ({
		page,
	}) => {
		await seedTheme(page, "dark");
		await page.goto("/login#login");
		await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
		const select = page.locator("select.tnd-langswitcher");
		await expect(select).toBeVisible({ timeout: 15_000 });
		const bg = await select.evaluate((el) => getComputedStyle(el).backgroundColor);
		expect(bg).toBe(DARK_SURFACE_RGB);
	});
});
