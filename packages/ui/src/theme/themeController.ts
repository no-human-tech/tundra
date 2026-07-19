/**
 * Shared light/dark theme controller — the design spec §2.5.
 *
 * Framework-free by design, matching this app's existing convention for
 * document-level UI preferences: apps/web/src/main.tsx syncs `<html lang>`
 * off i18next's `languageChanged` event rather than a React Context, because
 * the state (an attribute on `document.documentElement`) lives above any one
 * React tree and needs to reach vanilla DOM (native form controls via
 * `color-scheme`, the pre-hydration anti-FOUC script in index.html) as much
 * as React components. Theme follows the same pattern: a DOM CustomEvent is
 * the shared bus every mounted `ThemeToggle` subscribes to (see
 * useThemeSync.ts), which also naturally extends to the browser's native
 * cross-tab `storage` event.
 */

export type Theme = "light" | "dark";

export const APP_THEME_STORAGE_KEY = "tundra_theme";
export const THEME_CHANGE_EVENT = "tundra:theme-change";

function readStoredTheme(key: string): Theme | null {
	try {
		const value = window.localStorage.getItem(key);
		return value === "dark" || value === "light" ? value : null;
	} catch {
		return null;
	}
}

/**
 * Resolves the active theme from the persisted key, defaulting to light.
 * Light-first is a hard requirement of the design spec: first paint must
 * never flash the wrong theme.
 */
export function getTheme(): Theme {
	return readStoredTheme(APP_THEME_STORAGE_KEY) ?? "light";
}

/**
 * Applies `theme` to the document — the one place that touches the DOM.
 * Exported so `useThemeSync` can re-apply it for events that only carry a
 * value (the cross-tab `storage` event), not just for local writes.
 *
 * Always sets an explicit `data-theme` (never removes the attribute for
 * light) so "light" is an observable, asserted state, not merely the absence
 * of one — the app's e2e suite checks for `data-theme="light"` after an
 * explicit toggle back from dark.
 */
export function applyTheme(theme: Theme): void {
	document.documentElement.setAttribute("data-theme", theme);
	document.documentElement.style.colorScheme = theme;
}

export function setTheme(theme: Theme): void {
	applyTheme(theme);
	try {
		window.localStorage.setItem(APP_THEME_STORAGE_KEY, theme);
	} catch {
		// Storage unavailable (private browsing / disabled) — theme still
		// applies for this session via the DOM attribute, it just won't persist.
	}
	window.dispatchEvent(new CustomEvent<Theme>(THEME_CHANGE_EVENT, { detail: theme }));
}

export function toggleTheme(): Theme {
	const next: Theme = getTheme() === "dark" ? "light" : "dark";
	setTheme(next);
	return next;
}
