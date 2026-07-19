import "@testing-library/jest-dom/vitest";

import { afterEach, beforeAll, beforeEach, vi } from "vitest";

// Initialize i18next for the test environment. The module starts async init
// (loading only the active locale chunk); we await i18nReady in beforeAll so
// every test starts with a fully initialized i18n instance.
import i18n, { i18nReady } from "./src/i18n/index.js";

// Ensure i18next is fully initialized (active locale loaded, changeLanguage
// wrapper installed) before any test runs.
beforeAll(async () => {
	await i18nReady;
});

// Force English before every test so the existing English assertions are
// deterministic regardless of any locale a previous test switched to.
beforeEach(async () => {
	if (i18n.language !== "en") {
		await i18n.changeLanguage("en");
	}
});

// jsdom has no reachable GraphQL API. Every component that fetches on mount
// (AuthProvider's viewer query, MyTasksPage's queue load, ...) must fail fast
// and deterministically so tests land on their documented fallback instead of
// racing a real network attempt to localhost — a slow/late-settling real fetch
// is what caused "state update not wrapped in act(...)" warnings in tests that
// asserted before the request had a chance to resolve. Individual tests can
// still override this with their own `vi.stubGlobal("fetch", ...)`.
beforeEach(() => {
	vi.stubGlobal(
		"fetch",
		vi.fn(() => Promise.reject(new Error("network unavailable in jsdom"))),
	);
});

afterEach(() => {
	vi.unstubAllGlobals();
});
