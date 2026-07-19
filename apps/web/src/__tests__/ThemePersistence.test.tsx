import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ThemeToggle } from "@tundra/ui";

function renderToggle() {
	return render(
		<ThemeToggle labelSwitchToDark="Switch to dark" labelSwitchToLight="Switch to light" />,
	);
}

afterEach(() => {
	window.localStorage.clear();
	document.documentElement.removeAttribute("data-theme");
});

/**
 * The theme controller (packages/ui/src/theme/themeController.ts) is
 * framework-free and persists the choice under `tundra_theme`. Exercised here
 * through the shared <ThemeToggle/> since that is how every real surface
 * (Topbar, LoginPage) drives it.
 */
describe("theme persistence", () => {
	it("starts light with no data-theme flash", () => {
		renderToggle();
		expect(document.documentElement.getAttribute("data-theme")).not.toBe("dark");
	});

	it("writes the storage key and the DOM attribute when switched to dark", () => {
		renderToggle();
		fireEvent.click(screen.getByRole("button", { name: /switch to dark/i }));

		expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
		expect(document.documentElement.style.colorScheme).toBe("dark");
		expect(window.localStorage.getItem("tundra_theme")).toBe("dark");
	});

	it("toggling back to light updates the key and sets data-theme=light explicitly", () => {
		renderToggle();
		fireEvent.click(screen.getByRole("button", { name: /switch to dark/i }));
		fireEvent.click(screen.getByRole("button", { name: /switch to light/i }));

		expect(document.documentElement.getAttribute("data-theme")).toBe("light");
		expect(window.localStorage.getItem("tundra_theme")).toBe("light");
	});

	it("a mount picks up a theme already persisted from a previous session", () => {
		window.localStorage.setItem("tundra_theme", "dark");
		renderToggle();
		expect(screen.getByRole("button", { name: /switch to light/i })).toBeInTheDocument();
	});
});
