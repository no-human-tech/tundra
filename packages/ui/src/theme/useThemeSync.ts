import { useCallback, useEffect, useState } from "react";

import {
	applyTheme,
	getTheme,
	THEME_CHANGE_EVENT,
	toggleTheme,
	type Theme,
} from "./themeController.js";

/**
 * Subscribes a React tree to the shared theme controller.
 *
 * Two distinct sources, two distinct handlers:
 *  - `THEME_CHANGE_EVENT` fires in the SAME tab, right after `setTheme` has
 *    already applied the theme to the DOM — this handler only needs to sync
 *    React state (from the event's `detail`, no extra storage read).
 *  - The browser's native `storage` event fires in every OTHER tab/window
 *    (never the one that wrote the value), whose `document.documentElement`
 *    was never touched by that write — this handler must call `applyTheme`
 *    itself, or that tab's page keeps rendering the stale theme.
 */
export function useThemeSync(): [Theme, () => void] {
	const [theme, setThemeState] = useState<Theme>(() => getTheme());

	useEffect(() => {
		const onThemeChangeEvent = (event: Event) => {
			setThemeState((event as CustomEvent<Theme>).detail);
		};
		const onStorageEvent = () => {
			const next = getTheme();
			applyTheme(next);
			setThemeState(next);
		};
		window.addEventListener(THEME_CHANGE_EVENT, onThemeChangeEvent);
		window.addEventListener("storage", onStorageEvent);
		return () => {
			window.removeEventListener(THEME_CHANGE_EVENT, onThemeChangeEvent);
			window.removeEventListener("storage", onStorageEvent);
		};
	}, []);

	const toggle = useCallback(() => {
		setThemeState(toggleTheme());
	}, []);

	return [theme, toggle];
}
