import { useCallback, useState } from "react";

const STORAGE_KEY = "tnd-sidebar-collapsed";

/**
 * Persists the global sidebar collapse state in `localStorage`.
 * Returns `[collapsed, toggle]`. Safe to call in SSR-like environments
 * (localStorage access is guarded).
 */
export function useSidebarCollapsed(): [boolean, () => void] {
	const [collapsed, setCollapsed] = useState<boolean>(() => {
		try {
			return localStorage.getItem(STORAGE_KEY) === "1";
		} catch {
			return false;
		}
	});

	const toggle = useCallback(() => {
		setCollapsed((prev) => {
			const next = !prev;
			try {
				localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
			} catch {
				// Ignore — unavailable in test/private-browsing contexts.
			}
			return next;
		});
	}, []);

	return [collapsed, toggle];
}
