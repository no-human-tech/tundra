import { expect, test, type Page } from "@playwright/test";

/**
 * Pixel-oriented regression tests for `/login#login`.
 *
 * The reference PNG in `e2e/__screenshots__/login-light-1507x1060.png` comes
 * from the product mockup supplied with the audit. These tests intentionally
 * wait for the real login card, so a stuck full-width loader fails before any
 * screenshot comparison can pass accidentally.
 */

const REFERENCE_VIEWPORT = { width: 1507, height: 1060 };
const RUN_MOCKUP_PIXEL_TESTS = process.env.LOGIN_VISUAL_REFERENCE === "1";

test.use({
	locale: "pl-PL",
	colorScheme: "light",
	viewport: REFERENCE_VIEWPORT,
});

async function openReferenceLogin(page: Page) {
	await page.addInitScript(() => {
		localStorage.clear();
		localStorage.setItem("tundra_lang", "pl");
		localStorage.setItem("tundra_theme", "light");
	});

	await page.goto("/login#login", { waitUntil: "domcontentloaded" });
	await expect(page).toHaveURL(/\/login#login$/);
	await expect(page.getByRole("heading", { level: 1, name: "Witaj ponownie" })).toBeVisible({
		timeout: 10_000,
	});
	await expect(page.locator(".tnd-auth__card")).toBeVisible();
	await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

test.describe("/login#login readiness guard", () => {
	test("does not remain on a full-width loader and exposes the reference login controls", async ({
		page,
	}) => {
		await openReferenceLogin(page);

		await expect(page.locator("[aria-busy='true']")).toHaveCount(0);
		await expect(page.locator(".tnd-auth__card")).not.toHaveCSS(
			"width",
			`${REFERENCE_VIEWPORT.width}px`,
		);
		await expect(page.getByText("Zaloguj się do swojego obszaru Tundra.")).toBeVisible();
		await expect(page.getByLabel("E-mail")).toBeVisible();
		await expect(page.getByLabel("Hasło")).toBeVisible();
		await expect(page.getByRole("button", { name: "Zaloguj się" })).toBeVisible();
		await expect(page.getByRole("button", { name: "Nie pamiętasz hasła?" })).toBeVisible();
		await expect(page.getByText("Nie masz konta?")).toBeVisible();
		await expect(page.getByRole("button", { name: "Utwórz konto" })).toBeVisible();
		await expect(page.getByRole("link", { name: /Powrót na stronę główną/i })).toBeVisible();

		const cardBox = await page.locator(".tnd-auth__card").boundingBox();
		expect(cardBox).not.toBeNull();
		expect(cardBox?.width).toBeGreaterThan(360);
		expect(cardBox?.width).toBeLessThan(620);
		expect(Math.round((cardBox?.x ?? 0) + (cardBox?.width ?? 0) / 2)).toBe(
			Math.round(REFERENCE_VIEWPORT.width / 2),
		);
	});
});

test.describe("/login#login mockup pixel reference", () => {
	test.skip(
		!RUN_MOCKUP_PIXEL_TESTS,
		"set LOGIN_VISUAL_REFERENCE=1 to compare against the supplied mockup PNG",
	);

	test("shows the OAuth provider row exactly like the reference mockup", async ({ page }) => {
		await openReferenceLogin(page);

		const providerRow = page.locator(".tnd-oauth-row");
		await expect(providerRow).toBeVisible();
		await expect(providerRow.locator(".tnd-oauth-tile")).toHaveCount(4);
		await expect(page.getByLabel(/GitHub/)).toBeVisible();
		await expect(page.getByLabel(/GitLab/)).toBeVisible();
		await expect(page.getByLabel(/Google/)).toBeVisible();
		await expect(page.getByLabel(/Apple/)).toBeVisible();
		await expect(page.locator(".tnd-auth__divider")).toContainText("lub przez e-mail");
	});

	test("matches the supplied 1507x1060 light-mode reference screenshot", async ({ page }) => {
		await openReferenceLogin(page);

		await expect(page).toHaveScreenshot("login-light-1507x1060.png", {
			animations: "disabled",
			caret: "hide",
			fullPage: true,
			maxDiffPixelRatio: 0.01,
			threshold: 0.12,
		});
	});
});
