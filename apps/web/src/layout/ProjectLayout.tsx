import { useTranslation } from "react-i18next";
import { Navigate, Outlet, useLocation, useParams } from "react-router-dom";

import { AppShell, GlobalNavigation, ProjectHeader, ProjectNavigation } from "@tundra/ui";

import { useProjects } from "../data/index.js";
import { buildGlobalNav, buildProjectNav } from "../nav/navItems.js";
import { projectChrome } from "./chrome.js";
import { renderLink } from "./renderLink.js";
import { Topbar } from "./Topbar.js";
import { useSidebarCollapsed } from "./useSidebarCollapsed.js";
import { useSidebarProfile } from "./useSidebarProfile.js";

const STATUS_TONE = {
	Active: "success",
	Paused: "warning",
	Archived: "neutral",
} as const;

/** Project status -> projects.status.<key> translation key. */
const STATUS_KEY = {
	Active: "active",
	Paused: "paused",
	Archived: "archived",
} as const;

/**
 * Layout for PROJECT-scoped routes (/projects/:projectId/*). Composes AppShell
 * with the persistent global navigation AND the project context bar + project
 * sub-nav. The project nav is fed ONLY by PROJECT_NAV; the global nav stays
 * unchanged. Both nav landmarks ("Global" / "Project") are present and distinct.
 *
 * The project context bar (ProjectHeader's context-bar layout) shows the project
 * selector affordance, the status badge, the method label, the enabled-module
 * pills, and the "Manage →" link to project settings. It also carries the single
 * <h1> page-heading anchor for the project (tnd-project-title, focus-managed).
 */
export function ProjectLayout() {
	const { t } = useTranslation();
	const { projectId } = useParams();
	const { pathname } = useLocation();
	const [sidebarCollapsed, toggleSidebar] = useSidebarCollapsed();
	const profile = useSidebarProfile(t);
	const { findProject } = useProjects();

	if (!projectId) {
		return <Navigate to="/projects" replace />;
	}

	const project = findProject(projectId);
	if (!project) {
		return <Navigate to="/projects" replace />;
	}

	const section = pathname.split("/")[3];
	const global = buildGlobalNav(pathname, t);
	const projectNav = buildProjectNav(projectId, pathname, t);
	const { breadcrumbs, searchScope } = projectChrome(projectId, project.name, section, t);

	return (
		<AppShell
			topbar={<Topbar breadcrumbs={breadcrumbs} searchScope={searchScope} />}
			skipLinkLabel={t("shell.skipLink")}
			sidebarCollapsed={sidebarCollapsed}
			globalNav={
				<GlobalNavigation
					items={global.items}
					settingsItem={global.settingsItem}
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
			projectHeader={
				<ProjectHeader
					project={{
						id: project.id,
						key: project.key,
						name: project.name,
						status: t(`projects.status.${STATUS_KEY[project.status]}`),
						methodLabel: project.method === "scrum" ? "Scrum" : "Kanban",
					}}
					statusTone={STATUS_TONE[project.status]}
					modules={project.modules}
					moduleCount={project.modules.length}
					manageHref={`/projects/${projectId}/settings`}
					breadcrumbLabel={t("shell.projectBreadcrumbLabel")}
					selectProjectLabel={(name) => t("shell.switchProject", { name })}
					manageLabel={(count) => t("shell.modulesManage", { count })}
				/>
			}
			projectNav={
				<ProjectNavigation
					projectId={projectId}
					items={projectNav.items}
					settingsItem={projectNav.settingsItem}
					renderLink={renderLink}
					ariaLabel={t("nav.project.ariaLabel")}
				/>
			}
		>
			<Outlet />
		</AppShell>
	);
}
