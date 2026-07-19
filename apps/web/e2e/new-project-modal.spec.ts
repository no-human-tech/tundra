import { expect, test, type Page } from "@playwright/test";

/**
 * The "New project" modal — opened from all 4 entry points (topbar `+`, the
 * dashboard CTA, the /projects "Create project" button, and the /projects
 * dashed "create new project" tile), shared client-only state (no backend
 * call): validation (name required, at least one included Project Manager),
 * Cancel discards, Create appends the project and navigates into it.
 *
 * Kept in its own file per the parallel-work split — this file only covers
 * the New Project modal and does not touch app.spec.ts / screens-coverage /
 * states-coverage / pixel-audit / language-selector-style / footer-glyph /
 * mytasks-fullwidth.
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

const modal = (page: Page) => page.getByRole("dialog", { name: "New project" });

/** Fill the minimum required to enable Create: a name + one included PM. */
async function fillMinimumValid(page: Page, name: string) {
	await modal(page).getByLabel("Name").fill(name);
	await modal(page).getByRole("checkbox", { name: "Include Mira Lindqvist" }).click();
	await modal(page)
		.getByRole("combobox", { name: "Role for Mira Lindqvist" })
		.selectOption("Project Manager");
}

test.describe("New project modal", () => {
	test("opens from the topbar + button", async ({ page }) => {
		await seedLanguage(page, "en");
		await page.goto("/dashboard");
		await page.getByRole("button", { name: "New project" }).first().click();
		await expect(modal(page)).toBeVisible();
	});

	test("opens from the dashboard CTA", async ({ page }) => {
		await seedLanguage(page, "en");
		await page.goto("/dashboard");
		// The dashboard CTA and the topbar button share the same accessible name
		// ("New project") — the CTA is the accent button inside the page header.
		await page.getByRole("heading", { level: 1, name: "Dashboard" }).waitFor();
		await page.getByRole("button", { name: "New project" }).last().click();
		await expect(modal(page)).toBeVisible();
	});

	test("opens from the /projects 'Create project' button", async ({ page }) => {
		await seedLanguage(page, "en");
		await page.goto("/projects");
		await page.getByRole("button", { name: "Create project" }).click();
		await expect(modal(page)).toBeVisible();
	});

	test("opens from the /projects dashed 'create new project' tile", async ({ page }) => {
		await seedLanguage(page, "en");
		await page.goto("/projects");
		// Two elements share the "New project" accessible name on this page (the
		// topbar `+` button and the dashed tile) — the tile renders after the
		// topbar in DOM order (AppShell: <header> then <main>).
		await page.getByRole("button", { name: "New project", exact: true }).last().click();
		await expect(modal(page)).toBeVisible();
	});

	test("Create is disabled with an empty name", async ({ page }) => {
		await seedLanguage(page, "en");
		await page.goto("/projects");
		await page.getByRole("button", { name: "Create project" }).click();
		await expect(modal(page)).toBeVisible();

		await expect(modal(page).getByRole("button", { name: "Create" })).toBeDisabled();
	});

	test("Create stays disabled with a name but no included Project Manager", async ({ page }) => {
		await seedLanguage(page, "en");
		await page.goto("/projects");
		await page.getByRole("button", { name: "Create project" }).click();
		await expect(modal(page)).toBeVisible();

		await modal(page).getByLabel("Name").fill("Nebula Ops");
		await expect(modal(page).getByRole("button", { name: "Create" })).toBeDisabled();

		// Including a member without a Project Manager role still blocks Create.
		await modal(page).getByRole("checkbox", { name: "Include Mira Lindqvist" }).click();
		await expect(modal(page).getByRole("button", { name: "Create" })).toBeDisabled();
		await expect(
			modal(page).getByText("At least one included member must be a Project Manager."),
		).toBeVisible();
	});

	test("Cancel closes the modal without creating a project", async ({ page }) => {
		await seedLanguage(page, "en");
		await page.goto("/projects");
		await page.getByRole("button", { name: "Create project" }).click();
		await expect(modal(page)).toBeVisible();

		await modal(page).getByLabel("Name").fill("Should Not Persist");
		await modal(page).getByRole("button", { name: "Cancel" }).click();

		await expect(modal(page)).toHaveCount(0);
		await expect(page.getByText("Should Not Persist")).toHaveCount(0);
	});

	test("creating a project (name + included PM) closes the modal, lists the project, and navigates into it on click", async ({
		page,
	}) => {
		await seedLanguage(page, "en");
		await page.goto("/projects");
		await page.getByRole("button", { name: "Create project" }).click();
		await expect(modal(page)).toBeVisible();

		await fillMinimumValid(page, "Nebula Ops");
		await expect(modal(page).getByRole("button", { name: "Create" })).toBeEnabled();
		await modal(page).getByRole("button", { name: "Create" }).click();

		// Modal closes.
		await expect(modal(page)).toHaveCount(0);

		// The new project appears on /projects.
		const card = page.getByRole("link", { name: /Nebula Ops/ });
		await expect(card).toBeVisible();

		// Clicking it navigates into its overview screen.
		await card.click();
		await expect(page).toHaveURL(/\/projects\/[^/]+\/overview$/);
		await expect(page.getByRole("heading", { level: 1, name: "Nebula Ops" })).toBeVisible();
	});
});
