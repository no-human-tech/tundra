import { useTranslation } from "react-i18next";
import { Outlet, useLocation } from "react-router-dom";

import { AppShell, GlobalNavigation } from "@tundra/ui";

import { sampleMyTasks } from "../data/index.js";
import { buildGlobalNav } from "../nav/navItems.js";
import { globalChrome } from "./chrome.js";
import { renderLink } from "./renderLink.js";
import { Topbar } from "./Topbar.js";
import { useSidebarCollapsed } from "./useSidebarCollapsed.js";
import { useSidebarProfile } from "./useSidebarProfile.js";

/**
 * Layout for GLOBAL routes. Composes AppShell with the global navigation only —
 * no projectHeader, no projectNav — so a global route can never display a stale
 * project sub-navigation (the hard separation rule).
 *
 * The topbar shows a one-level breadcrumb and the workspace-scoped search hint.
 */
export function GlobalLayout() {
	const { t } = useTranslation();
	const { pathname } = useLocation();
	const [sidebarCollapsed, toggleSidebar] = useSidebarCollapsed();
	const { items, settingsItem } = buildGlobalNav(pathname, t, {
		myTasks: sampleMyTasks.length,
	});
	const { breadcrumbs, searchScope } = globalChrome(pathname, t);
	const profile = useSidebarProfile(t);

	return (
		<AppShell
			topbar={<Topbar breadcrumbs={breadcrumbs} searchScope={searchScope} />}
			skipLinkLabel={t("shell.skipLink")}
			sidebarCollapsed={sidebarCollapsed}
			globalNav={
				<GlobalNavigation
					items={items}
					settingsItem={settingsItem}
					renderLink={renderLink}
					ariaLabel={t("nav.global.ariaLabel")}
					workspaceGroupLabel={t("nav.global.workspaceGroupLabel")}
					modulesGroupLabel={t("nav.global.modulesGroupLabel")}
					collapsed={sidebarCollapsed}
					onToggle={toggleSidebar}
					collapseLabel={t("nav.global.collapseSidebar")}
					expandLabel={t("nav.global.expandSidebar")}
					profile={profile}
					profileGroupLabel={t("nav.global.signedIn")}
					profileSettingsLabel={t("nav.global.workspaceSettings")}
				/>
			}
		>
			<Outlet />
		</AppShell>
	);
}
