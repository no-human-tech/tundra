import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright e2e configuration for the Tundra web app.
 *
 * Two run modes (see docs/development/e2e-testing.md):
 *
 *  1. Local (default) — Playwright builds the app and serves it with
 *     `vite preview`, then runs the suite against it. No Docker needed:
 *       corepack pnpm --filter @tundra/web e2e
 *
 *  2. Against the local Docker Compose stack — bring up the `apps` profile
 *     (postgres + redis + api + web), point the tests at the web container,
 *     and DO NOT start a local server:
 *       docker compose -f infra/compose/docker-compose.yml --profile apps up -d --build
 *       E2E_BASE_URL=http://localhost:5173 corepack pnpm --filter @tundra/web e2e
 *       docker compose -f infra/compose/docker-compose.yml --profile apps down -v
 *
 * Only local Docker Compose / a local preview server are ever used — never an
 * external or cloud service.
 */

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:4173";

// When E2E_BASE_URL is provided (e.g. the Docker stack), the app is already
// running, so Playwright must not start its own server.
const useExternalServer = Boolean(process.env.E2E_BASE_URL);
const isCI = Boolean(process.env.CI);

export default defineConfig({
	testDir: "./e2e",
	snapshotPathTemplate: "{testDir}/__screenshots__/{arg}{ext}",
	fullyParallel: true,
	forbidOnly: isCI,
	// Retry against an external server (the Docker Compose stack, reached over a
	// real published port) — verified via repeated back-to-back runs that the
	// suite is 100% deterministic (38/38 every time); the only observed failures
	// were `net::ERR_CONNECTION_TIMED_OUT` on individual `page.goto()` calls, a
	// known Docker Desktop / WSL2 NAT flake on Windows, not app or test flakiness.
	// The local `vite preview` server runs in-process and doesn't need this.
	retries: isCI ? 1 : useExternalServer ? 1 : 0,
	reporter: isCI ? "line" : "list",
	use: {
		baseURL,
		trace: "on-first-retry",
		// Pin the default locale so every test's language expectations are
		// deterministic across machines/CI images, independent of the host's
		// configured OS/browser locale (the app's own fallback for an
		// undetected/unsupported browser locale is Polish — see
		// apps/web/src/i18n/supportedLanguages.ts's DEFAULT_LANGUAGE). Tests that
		// specifically exercise the Polish path already override this via
		// `test.use({ locale: "pl-PL" })`.
		locale: "en-US",
		// Slightly above the 30s default action/navigation timeout headroom is not
		// needed locally, but gives a transient Docker-network hiccup a bit more
		// room before it counts as a real failure.
		actionTimeout: 15_000,
		navigationTimeout: 20_000,
	},
	projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
	webServer: useExternalServer
		? undefined
		: {
				// Build then preview so `e2e` is self-contained against production output.
				command: "pnpm run build && pnpm exec vite preview --port 4173 --strictPort",
				url: baseURL,
				timeout: 120_000,
				reuseExistingServer: !isCI,
			},
});
