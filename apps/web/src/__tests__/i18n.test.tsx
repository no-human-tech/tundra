import { act, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import i18n from "../i18n/index.js";
import enLocale from "../i18n/locales/en.json";
import plLocale from "../i18n/locales/pl.json";
import esLocale from "../i18n/locales/es.json";
import deLocale from "../i18n/locales/de.json";
import frLocale from "../i18n/locales/fr.json";
import itLocale from "../i18n/locales/it.json";
import zhLocale from "../i18n/locales/zh.json";
import koLocale from "../i18n/locales/ko.json";
import jaLocale from "../i18n/locales/ja.json";
import { App } from "../App.js";
import { MyTasksPage } from "../pages/MyTasksPage.js";
import { myTasksGroups } from "../data/index.js";
import { renderAtPath } from "./testRouter.js";

/** Flatten an object into dotted leaf-key paths. */
function flatten(obj: unknown, prefix = ""): string[] {
	const out: string[] = [];
	for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
		const path = prefix ? `${prefix}.${k}` : k;
		if (v && typeof v === "object" && !Array.isArray(v)) out.push(...flatten(v, path));
		else out.push(path);
	}
	return out;
}

// Every test starts in English (vitest.setup also enforces this).
beforeEach(async () => {
	await i18n.changeLanguage("en");
});

afterEach(async () => {
	await i18n.changeLanguage("en");
});

describe("i18n: language switching", () => {
	it("changes nav + page text when the language changes, then switches back", async () => {
		await renderAtPath("/dashboard", <App />);

		// English first.
		expect(screen.getByRole("navigation", { name: "Global" })).toBeInTheDocument();
		expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();

		// Switch to Polish: the global nav landmark + page heading are translated.
		await act(async () => {
			await i18n.changeLanguage("pl");
		});
		expect(screen.getByRole("navigation", { name: "Globalne" })).toBeInTheDocument();
		expect(screen.getByRole("heading", { level: 1, name: "Pulpit" })).toBeInTheDocument();
		expect(screen.queryByRole("navigation", { name: "Global" })).not.toBeInTheDocument();

		// Switch back to English.
		await act(async () => {
			await i18n.changeLanguage("en");
		});
		expect(screen.getByRole("navigation", { name: "Global" })).toBeInTheDocument();
		expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
	});
});

describe("i18n: fallback to English", () => {
	it("resolves a key missing from a locale to the English string (no crash/empty)", async () => {
		// Temporarily drop `dashboard.title` from the (supported) Polish bundle by
		// re-adding a deep clone without that key. With fallbackLng:"en" +
		// returnNull:false the missing key must resolve to the English master string,
		// never empty and never the raw key.
		const plClone = JSON.parse(JSON.stringify(plLocale.translation)) as typeof plLocale.translation;
		const plTitle = plClone.dashboard.title;
		delete (plClone.dashboard as { title?: string }).title;

		i18n.removeResourceBundle("pl", "translation");
		i18n.addResourceBundle("pl", "translation", plClone, true, true);
		await i18n.changeLanguage("pl");

		// A key still present in pl resolves to the Polish value.
		expect(i18n.t("dashboard.kicker")).toBe(plLocale.translation.dashboard.kicker);
		// The removed key falls back to English (not empty, not the raw key).
		expect(i18n.t("dashboard.title")).toBe(enLocale.translation.dashboard.title);
		expect(i18n.t("dashboard.title")).not.toBe("");
		expect(i18n.t("dashboard.title")).not.toBe("dashboard.title");

		// Restore the full Polish bundle so later tests are unaffected.
		i18n.removeResourceBundle("pl", "translation");
		i18n.addResourceBundle(
			"pl",
			"translation",
			{ ...plClone, dashboard: { ...plClone.dashboard, title: plTitle } },
			true,
			true,
		);
		await i18n.changeLanguage("en");
	});
});

describe("i18n: key coverage", () => {
	const locales = {
		pl: plLocale,
		es: esLocale,
		de: deLocale,
		fr: frLocale,
		it: itLocale,
		zh: zhLocale,
		ko: koLocale,
		ja: jaLocale,
	} as const;
	const masterKeys = flatten(enLocale.translation).sort();

	for (const [code, data] of Object.entries(locales)) {
		it(`${code} has exactly the en key set`, () => {
			const keys = flatten((data as typeof enLocale).translation).sort();
			expect(keys).toEqual(masterKeys);
		});
	}
});

describe("i18n: translated navigation", () => {
	it("global nav labels differ between en and ja", async () => {
		const { unmount } = await renderAtPath("/dashboard", <App />);
		const enGlobal = screen.getByRole("navigation", { name: "Global" });
		const enMyTasks = within(enGlobal).getByText("My Tasks");
		expect(enMyTasks).toBeInTheDocument();
		unmount();

		await i18n.changeLanguage("ja");
		await renderAtPath("/dashboard", <App />);
		const jaGlobal = screen.getByRole("navigation", { name: "グローバル" });
		expect(within(jaGlobal).getByText("マイタスク")).toBeInTheDocument();
		// The English label is gone under ja.
		expect(within(jaGlobal).queryByText("My Tasks")).not.toBeInTheDocument();
	});
});

describe("i18n: My Tasks in Polish and Japanese", () => {
	it("renders the translated title + mixed-source rows via one WorkItemRow (pl)", async () => {
		await i18n.changeLanguage("pl");
		await renderAtPath("/my-tasks", <MyTasksPage />);

		expect(
			await screen.findByRole("heading", { level: 1, name: "Moje zadania" }),
		).toBeInTheDocument();

		// Wait for the first translated group list to appear (demo fallback).
		const firstGroupPl = "Dziś";
		await screen.findByRole("list", { name: firstGroupPl });

		// Mixed sources still render through ONE row component: every queue row is a
		// .tnd-workitem-row with exactly one open button, and the source badge keeps
		// its data-source metadata (source-as-metadata invariant intact).
		const rows = document.querySelectorAll(".tnd-workitem-row");
		expect(rows.length).toBeGreaterThan(0);
		for (const row of rows) {
			expect(within(row as HTMLElement).getAllByRole("button")).toHaveLength(1);
		}
		// The translated source badge labels appear and the data-source attr persists.
		expect(document.querySelector('[data-source="bug"]')).toBeTruthy();
		expect(document.querySelector('[data-source="task"]')).toBeTruthy();
		expect(screen.getAllByText("Błąd").length).toBeGreaterThan(0); // bug -> Błąd
	});

	it("renders the translated title + invariant intact (ja)", async () => {
		await i18n.changeLanguage("ja");
		await renderAtPath("/my-tasks", <MyTasksPage />);

		expect(
			await screen.findByRole("heading", { level: 1, name: "マイタスク" }),
		).toBeInTheDocument();

		await screen.findByRole("list", { name: "今日" });

		const rows = document.querySelectorAll(".tnd-workitem-row");
		expect(rows.length).toBe(myTasksGroups.reduce((a, g) => a + g.entries.length, 0));
		// Source-as-metadata: badges carry data-source; the translated label shows.
		expect(document.querySelector('[data-source="bug"]')).toBeTruthy();
		expect(screen.getAllByText("バグ").length).toBeGreaterThan(0); // bug -> バグ
	});
});
