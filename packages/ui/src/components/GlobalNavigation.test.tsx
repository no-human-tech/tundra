import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { GlobalNavigation } from "./GlobalNavigation.js";

/**
 * The signed-in profile card fixed to the bottom of the rail
 * (the design spec §6/§7.4). Presentational-only contract: the app decides
 * whether to pass `profile` at all (e.g. omitting it when no one is signed in).
 */
describe("GlobalNavigation profile card", () => {
	it("renders avatar, name, role and a settings link when `profile` is provided", () => {
		const html = renderToStaticMarkup(
			<GlobalNavigation
				items={[{ id: "dashboard", label: "Dashboard", href: "/dashboard", isActive: true }]}
				settingsItem={{ id: "workspaceSettings", label: "Workspace Settings", href: "/settings" }}
				profile={{ name: "Ada Torres", meta: "Admin" }}
				profileGroupLabel="Logged in"
				profileSettingsLabel="Workspace settings"
			/>,
		);
		expect(html).toContain("Logged in");
		expect(html).toContain("Ada Torres");
		expect(html).toContain("Admin");
		expect(html).toContain("Workspace settings");
		expect(html).toContain('href="/settings"');
	});

	it("omits the card entirely when no `profile` is provided (e.g. no session)", () => {
		const html = renderToStaticMarkup(
			<GlobalNavigation
				items={[{ id: "dashboard", label: "Dashboard", href: "/dashboard", isActive: true }]}
				settingsItem={{ id: "workspaceSettings", label: "Workspace Settings", href: "/settings" }}
			/>,
		);
		expect(html).not.toContain("Ada Torres");
		expect(html).not.toContain("tnd-nav__profile");
	});
});
