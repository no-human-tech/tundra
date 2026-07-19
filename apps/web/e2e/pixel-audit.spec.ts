import { expect, test, type Browser, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Pixel-perfect AUDIT harness — checks the LIVE app against the documented
 * design-spec ground truth (token tables §2.1/§2.3).
 *
 * This diffs the live app's computed CSS custom properties + geometry against
 * the design-spec token tables, with full-page screenshots captured as
 * supporting evidence.
 *
 * This spec is an AUDIT TOOL, not a regression gate: it is guarded behind
 * PIXEL_AUDIT=1 (mirrors the LOGIN_VISUAL_REFERENCE convention in
 * login-visual.spec.ts) and is never picked up by the default `pnpm run e2e`.
 * It never "fixes" anything it finds — see artifacts/pixel-audit/<ts>/results.json
 * for the full mismatch list.
 *
 * Usage:
 *   PIXEL_AUDIT=1 pnpm --filter @tundra/web exec playwright test pixel-audit
 *   (or with the Docker stack: PIXEL_AUDIT=1 E2E_BASE_URL=http://localhost:5173 ...)
 */

const RUN_PIXEL_AUDIT = process.env.PIXEL_AUDIT === "1";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PROJECT_ID = "proj-core";
const VIEWPORT_HEIGHT = 900;

// ─────────────────────────────────────────────────────────────────────────────
// Ground truth — design spec §2.1 (app tokens), §2.3 (constants)
// ─────────────────────────────────────────────────────────────────────────────

interface TokenSpec {
	light: string;
	dark: string;
}

// Spec token name -> live `--tnd-*` custom property it maps to.
const APP_TOKEN_ALIAS: Record<string, string> = {
	"--t-bg": "--tnd-color-bg",
	"--t-surface": "--tnd-color-surface",
	"--t-line": "--tnd-color-border",
	"--t-ink": "--tnd-color-text",
	"--t-body": "--tnd-color-text-muted",
	"--t-accent": "--tnd-color-brand",
	"--t-mint": "--tnd-color-brand-bright",
};

const APP_TOKEN_SPEC: Record<string, TokenSpec> = {
	"--t-bg": { light: "#F4F7F6", dark: "#0A1714" },
	"--t-surface": { light: "#ffffff", dark: "#112A24" },
	"--t-line": { light: "#E4ECEA", dark: "rgba(255,255,255,.10)" },
	"--t-ink": { light: "#16302B", dark: "#EAF6F1" },
	"--t-body": { light: "#4B5A61", dark: "#A8C2BA" },
	"--t-accent": { light: "#0F766E", dark: "#2FBFA3" },
	"--t-mint": { light: "#14B88F", dark: "#2FBFA3" },
};

const ORANGE_CONSTANTS = { base: "#FF8A3D", hover: "#F2740F", active: "#E5511A" };

// ─────────────────────────────────────────────────────────────────────────────
// State matrix
// ─────────────────────────────────────────────────────────────────────────────

interface AppRoute {
	key: string;
	path: string;
	/** true when this route renders inside ProjectLayout (has a .tnd-projectnav). */
	isProjectRoute: boolean;
}

// Route paths taken directly from apps/web/src/App.tsx.
const APP_ROUTES: AppRoute[] = [
	{ key: "login", path: "/login#login", isProjectRoute: false },
	{ key: "dashboard", path: "/dashboard", isProjectRoute: false },
	{ key: "projects", path: "/projects", isProjectRoute: false },
	{ key: "project-overview", path: `/projects/${PROJECT_ID}/overview`, isProjectRoute: true },
	{ key: "board", path: `/projects/${PROJECT_ID}/board`, isProjectRoute: true },
	{ key: "my-tasks", path: "/my-tasks", isProjectRoute: false },
	{ key: "extensions", path: "/extensions", isProjectRoute: false },
	{ key: "settings", path: "/settings", isProjectRoute: false },
	{ key: "design-system", path: "/design-system", isProjectRoute: false },
];

const APP_VIEWPORTS = [1440, 1024, 680];
const THEMES = ["light", "dark"] as const;
const LANGS = ["pl", "en"] as const;

type Theme = (typeof THEMES)[number];
type Lang = (typeof LANGS)[number];

// ─────────────────────────────────────────────────────────────────────────────
// Color parsing / comparison helpers
// ─────────────────────────────────────────────────────────────────────────────

interface Rgba {
	r: number;
	g: number;
	b: number;
	a: number;
}

/** Parses `#rgb`/`#rrggbb` or `rgb()`/`rgba()` (any whitespace, with or without
 * a leading zero on the alpha component) into an {r,g,b,a} tuple. Returns null
 * for anything else (e.g. `none`, empty string, unresolved custom property). */
function parseColor(raw: string | null | undefined): Rgba | null {
	if (!raw) return null;
	const s = raw.trim();

	const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
	if (hex) {
		let h = hex[1];
		if (h.length === 3) {
			h = h
				.split("")
				.map((c) => c + c)
				.join("");
		}
		return {
			r: parseInt(h.slice(0, 2), 16),
			g: parseInt(h.slice(2, 4), 16),
			b: parseInt(h.slice(4, 6), 16),
			a: 1,
		};
	}

	const fn = s.match(
		/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)$/i,
	);
	if (fn) {
		return {
			r: Number(fn[1]),
			g: Number(fn[2]),
			b: Number(fn[3]),
			a: fn[4] !== undefined ? Number(fn[4]) : 1,
		};
	}

	return null;
}

function colorsMatch(a: string | null | undefined, b: string | null | undefined, tol = 2): boolean {
	const pa = parseColor(a);
	const pb = parseColor(b);
	if (!pa || !pb) return false;
	return (
		Math.abs(pa.r - pb.r) <= tol &&
		Math.abs(pa.g - pb.g) <= tol &&
		Math.abs(pa.b - pb.b) <= tol &&
		Math.abs(pa.a - pb.a) <= 0.02
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Result shapes (written verbatim into results.json)
// ─────────────────────────────────────────────────────────────────────────────

interface TokenCheckResult {
	token: string;
	cssVar: string;
	expectedLight: string;
	expectedDark: string;
	expected: string;
	actualRaw: string | null;
	matches: boolean;
}

interface ComboResult {
	area: "app";
	routeKey: string;
	route: string;
	viewportWidth: number;
	theme: Theme;
	lang: Lang;
	screenshot: string;
	tokenChecks: TokenCheckResult[];
	additionalChecks: Record<string, unknown>;
	consoleErrors: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Console error collection — mirrors app.spec.ts's collectConsoleErrors, the
// only documented benign noise source (the viewer/auth GraphQL probe failing
// with no API running) is filtered identically.
// ─────────────────────────────────────────────────────────────────────────────

function collectConsoleErrors(page: Page): string[] {
	const errors: string[] = [];
	const isKnownApiUnavailableNoise = (msg: { text(): string; location(): { url: string } }) => {
		const text = msg.text();
		const url = msg.location().url;
		const targetsGraphqlEndpoint = /\/graphql(\?|$)/i.test(url) || /graphql/i.test(text);
		return targetsGraphqlEndpoint && (/CORS/i.test(text) || /net::ERR_/i.test(text));
	};
	page.on("console", (msg) => {
		if (msg.type() === "error" && !isKnownApiUnavailableNoise(msg)) {
			errors.push(msg.text());
		}
	});
	page.on("pageerror", (err) => errors.push(err.message));
	return errors;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-area check helpers
// ─────────────────────────────────────────────────────────────────────────────

async function readCssVar(page: Page, name: string): Promise<string | null> {
	return page.evaluate((n) => {
		const v = getComputedStyle(document.documentElement).getPropertyValue(n);
		return v ? v.trim() : null;
	}, name);
}

async function tokenChecks(
	page: Page,
	spec: Record<string, TokenSpec>,
	alias: Record<string, string> | null,
	theme: Theme,
): Promise<TokenCheckResult[]> {
	const results: TokenCheckResult[] = [];
	for (const [token, expected] of Object.entries(spec)) {
		const cssVar = alias?.[token] ?? token;
		const actualRaw = await readCssVar(page, cssVar);
		const expectedValue = theme === "light" ? expected.light : expected.dark;
		results.push({
			token,
			cssVar,
			expectedLight: expected.light,
			expectedDark: expected.dark,
			expected: expectedValue,
			actualRaw,
			matches: colorsMatch(actualRaw, expectedValue),
		});
	}
	return results;
}

/** Orange-accent leak check: nav/chrome background/border must never render
 * close to the orange accent constants (design spec §2.3). */
async function orangeLeakCheck(page: Page, selectors: string[]) {
	const elements: Array<{
		selector: string;
		found: boolean;
		backgroundColor: string | null;
		borderColor: string | null;
		violatesOrange: boolean;
	}> = [];
	for (const selector of selectors) {
		const loc = page.locator(selector).first();
		const found = (await loc.count()) > 0;
		if (!found) {
			elements.push({
				selector,
				found: false,
				backgroundColor: null,
				borderColor: null,
				violatesOrange: false,
			});
			continue;
		}
		const { backgroundColor, borderColor } = await loc.evaluate((el) => {
			const cs = getComputedStyle(el);
			return { backgroundColor: cs.backgroundColor, borderColor: cs.borderTopColor };
		});
		const violatesOrange = [
			ORANGE_CONSTANTS.base,
			ORANGE_CONSTANTS.hover,
			ORANGE_CONSTANTS.active,
		].some(
			(orange) => colorsMatch(backgroundColor, orange, 6) || colorsMatch(borderColor, orange, 6),
		);
		elements.push({ selector, found: true, backgroundColor, borderColor, violatesOrange });
	}
	return { elements, anyViolation: elements.some((e) => e.violatesOrange) };
}

async function discussionsAbsentCheck(page: Page): Promise<boolean> {
	const text = await page.locator("body").innerText();
	return !/discussion|dyskusj|discourse/i.test(text);
}

async function typographyCheck(page: Page) {
	const bodyFontFamily = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
	const monoCandidates = [".tnd-badge", ".tnd-kanban-card__id"];
	let monoSelectorUsed: string | null = null;
	let monoFontFamily: string | null = null;
	for (const selector of monoCandidates) {
		const loc = page.locator(selector).first();
		if ((await loc.count()) > 0 && (await loc.isVisible().catch(() => false))) {
			monoFontFamily = await loc.evaluate((el) => getComputedStyle(el).fontFamily);
			monoSelectorUsed = selector;
			break;
		}
	}
	return {
		bodyFontFamily,
		bodyIncludesRoboto:
			/roboto/i.test(bodyFontFamily) && !/roboto mono/i.test(bodyFontFamily.split(",")[0]),
		monoSelectorUsed,
		monoFontFamily,
		monoIncludesRobotoMono: monoFontFamily ? /roboto mono/i.test(monoFontFamily) : null,
	};
}

// Global-only paths that must never appear as a link target inside the
// project-scoped nav (the project-nav-isolation invariant, also exercised in
// app.spec.ts's "navigation separation" suite).
const GLOBAL_ONLY_PATHS = [
	"/my-tasks",
	"/dashboard",
	"/projects",
	"/extensions",
	"/settings",
	"/time",
	"/reports",
	"/design-system",
];

async function projectNavIsolationCheck(page: Page) {
	// Locale-independent: the accessible name is translated (e.g. Polish
	// "Projekt", not "Project"), so a name-based role query would silently miss
	// every non-English combo. `.tnd-projectnav` is the stable class regardless
	// of language (see packages/ui/src/components/ProjectNavigation.tsx).
	const projectNav = page.locator(".tnd-projectnav");
	if ((await projectNav.count()) === 0) return null;
	const hrefs = await projectNav
		.locator("a")
		.evaluateAll((els) => els.map((el) => el.getAttribute("href")));
	const offending = hrefs.filter((h): h is string => !!h && GLOBAL_ONLY_PATHS.includes(h));
	return { hrefs, offending, pass: offending.length === 0 };
}

async function appRwdCheck(page: Page, viewportWidth: number) {
	const nav = page.locator(".tnd-globalnav").first();
	if ((await nav.count()) === 0) {
		return { note: "no .tnd-globalnav on this route" };
	}
	const box = await nav.boundingBox();
	const position = await nav.evaluate((el) => getComputedStyle(el).position);
	const expectedWidth = viewportWidth > 1024 ? 236 : viewportWidth > 680 ? 70 : null;
	const width = box?.width ?? null;
	const widthPass =
		expectedWidth !== null && width !== null ? Math.abs(width - expectedWidth) <= 4 : null;
	let bottomPinnedPass: boolean | null = null;
	if (viewportWidth <= 680) {
		const rect = await nav.evaluate((el) => el.getBoundingClientRect());
		bottomPinnedPass = position === "fixed" && Math.abs(rect.bottom - VIEWPORT_HEIGHT) <= 2;
	}
	return { width, expectedWidth, widthPass, position, bottomPinnedPass };
}

// ─────────────────────────────────────────────────────────────────────────────
// Combo runners
// ─────────────────────────────────────────────────────────────────────────────

async function seedStorage(
	browser: Browser,
	width: number,
	themeKey: string,
	theme: Theme,
	langKey: string,
	lang: Lang,
) {
	const context = await browser.newContext({ viewport: { width, height: VIEWPORT_HEIGHT } });
	await context.addInitScript(
		([tKey, tVal, lKey, lVal]) => {
			try {
				localStorage.setItem(tKey, tVal);
				localStorage.setItem(lKey, lVal);
			} catch {
				// ignore — private-mode/blocked storage
			}
		},
		[themeKey, theme, langKey, lang],
	);
	return context;
}

async function waitForRouteReady(page: Page, routeKey: string) {
	try {
		if (routeKey === "login") {
			await page.locator(".tnd-auth__card").first().waitFor({ state: "visible", timeout: 10_000 });
		} else {
			await page.locator("h1").first().waitFor({ state: "visible", timeout: 10_000 });
		}
	} catch {
		// best-effort — proceed and let the checks below note what's missing
	}
	await page
		.evaluate(() => (document.fonts ? document.fonts.ready.then(() => undefined) : undefined))
		.catch(() => undefined);
}

async function auditAppCombo(
	browser: Browser,
	artifactsDir: string,
	route: AppRoute,
	width: number,
	theme: Theme,
	lang: Lang,
): Promise<ComboResult> {
	const context = await seedStorage(browser, width, "tundra_theme", theme, "tundra_lang", lang);
	const page = await context.newPage();
	const consoleErrors = collectConsoleErrors(page);
	try {
		await page.goto(route.path, { waitUntil: "domcontentloaded" });
		await waitForRouteReady(page, route.key);

		const screenshotName = `app-${route.key}-${theme}-${lang}-${width}.png`;
		await page.screenshot({ path: path.join(artifactsDir, screenshotName), fullPage: true });

		const [tokens, orangeLeak, discussionsAbsent, typography, rwd] = await Promise.all([
			tokenChecks(page, APP_TOKEN_SPEC, APP_TOKEN_ALIAS, theme),
			orangeLeakCheck(
				page,
				route.key === "login"
					? [".tnd-auth__bar"]
					: route.isProjectRoute
						? [".tnd-globalnav", ".tnd-topbar", ".tnd-projectnav"]
						: [".tnd-globalnav", ".tnd-topbar"],
			),
			discussionsAbsentCheck(page),
			typographyCheck(page),
			appRwdCheck(page, width),
		]);
		const projectNavIsolation = route.isProjectRoute ? await projectNavIsolationCheck(page) : null;

		return {
			area: "app",
			routeKey: route.key,
			route: route.path,
			viewportWidth: width,
			theme,
			lang,
			screenshot: screenshotName,
			tokenChecks: tokens,
			additionalChecks: { orangeLeak, discussionsAbsent, typography, rwd, projectNavIsolation },
			consoleErrors,
		};
	} finally {
		await context.close();
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Test suite
// ─────────────────────────────────────────────────────────────────────────────

test.describe("pixel-perfect audit vs the design spec (evidence-gathering, non-gating)", () => {
	test.skip(
		!RUN_PIXEL_AUDIT,
		"set PIXEL_AUDIT=1 to run the full computed-style + geometry audit matrix (slow; not part of the default e2e gate)",
	);
	test.describe.configure({ mode: "serial" });

	let artifactsDir = "";
	const allResults: ComboResult[] = [];

	test.beforeAll(async () => {
		const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
		artifactsDir = path.join(__dirname, "..", "artifacts", "pixel-audit", timestamp);
		await mkdir(artifactsDir, { recursive: true });
	});

	test.afterAll(async () => {
		if (artifactsDir) {
			await writeFile(
				path.join(artifactsDir, "results.json"),
				JSON.stringify(allResults, null, 2),
				"utf-8",
			);
		}
	});

	test("app state matrix (1440/1024/680 x light/dark x pl/en x 9 routes)", async ({ browser }) => {
		test.setTimeout(25 * 60 * 1000);
		test.slow();
		for (const route of APP_ROUTES) {
			for (const width of APP_VIEWPORTS) {
				for (const theme of THEMES) {
					for (const lang of LANGS) {
						allResults.push(await auditAppCombo(browser, artifactsDir, route, width, theme, lang));
					}
				}
			}
		}
		expect(allResults.filter((r) => r.area === "app")).toHaveLength(
			APP_ROUTES.length * APP_VIEWPORTS.length * THEMES.length * LANGS.length,
		);
	});

	test("first-render no-flicker: data-theme is correct before app JS runs", async ({ browser }) => {
		const record: Record<string, unknown> = {};

		// Seeded dark: the anti-FOUC inline script in index.html must already have
		// set data-theme="dark" at domcontentloaded, before React mounts.
		const darkContext = await browser.newContext();
		await darkContext.addInitScript(() => {
			try {
				localStorage.setItem("tundra_theme", "dark");
			} catch {
				// ignore
			}
		});
		const darkPage = await darkContext.newPage();
		await darkPage.goto("/dashboard", { waitUntil: "domcontentloaded" });
		record.seededDarkAtDomContentLoaded = await darkPage.evaluate(() =>
			document.documentElement.getAttribute("data-theme"),
		);
		await darkContext.close();

		// Unseeded: must default to light (no data-theme=dark attribute).
		const lightContext = await browser.newContext();
		const lightPage = await lightContext.newPage();
		await lightPage.goto("/dashboard", { waitUntil: "domcontentloaded" });
		record.unseededAtDomContentLoaded = await lightPage.evaluate(() =>
			document.documentElement.getAttribute("data-theme"),
		);
		await lightContext.close();

		record.pass =
			record.seededDarkAtDomContentLoaded === "dark" &&
			record.unseededAtDomContentLoaded !== "dark";

		if (artifactsDir) {
			await writeFile(
				path.join(artifactsDir, "no-flicker.json"),
				JSON.stringify(record, null, 2),
				"utf-8",
			);
		}
	});

	test("theme/lang persistence survives reload", async ({ browser }) => {
		const record: Record<string, unknown> = {};

		const appContext = await browser.newContext();
		const appPage = await appContext.newPage();
		await appPage.goto("/dashboard", { waitUntil: "domcontentloaded" });
		// Wait for the app to finish mounting (i18next's LanguageDetector caches
		// its own detected default into localStorage on init) BEFORE writing —
		// otherwise a write landing in that init race gets silently clobbered by
		// the detector's own write-back, which is not a real user scenario (a
		// real toggle click always happens well after mount).
		await waitForRouteReady(appPage, "dashboard");
		await appPage.evaluate(() => {
			localStorage.setItem("tundra_theme", "dark");
			localStorage.setItem("tundra_lang", "en");
		});
		await appPage.reload({ waitUntil: "domcontentloaded" });
		await waitForRouteReady(appPage, "dashboard");
		record.appThemeAfterReload = await appPage.evaluate(() =>
			document.documentElement.getAttribute("data-theme"),
		);
		record.appLangAfterReload = await appPage.evaluate(() =>
			document.documentElement.getAttribute("lang"),
		);
		record.appThemeStorageAfterReload = await appPage.evaluate(() =>
			localStorage.getItem("tundra_theme"),
		);
		record.appLangStorageAfterReload = await appPage.evaluate(() =>
			localStorage.getItem("tundra_lang"),
		);
		await appContext.close();

		record.pass =
			record.appThemeAfterReload === "dark" &&
			record.appThemeStorageAfterReload === "dark" &&
			record.appLangStorageAfterReload === "en";

		if (artifactsDir) {
			await writeFile(
				path.join(artifactsDir, "persistence.json"),
				JSON.stringify(record, null, 2),
				"utf-8",
			);
		}
	});
});
