import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import { GlobalLayout } from "./layout/GlobalLayout.js";
import { ProjectLayout } from "./layout/ProjectLayout.js";
import {
	DashboardPage,
	DesignSystemPage,
	ExtensionsPage,
	NotFoundPage,
	ProjectsPage,
	ReportsPage,
	TimePage,
	WorkspaceSettingsPage,
	WorkspaceMembersPage,
} from "./pages/global/GlobalPages.js";
import { LoginPage } from "./pages/LoginPage.js";
import { AuthProvider } from "./auth/AuthContext.js";
import { NewProjectModalProvider } from "./components/NewProjectModalContext.js";
import { ProjectsProvider } from "./data/index.js";
import {
	ProjectBacklogPage,
	ProjectBoardPage,
	ProjectDocsPage,
	ProjectOverviewPage,
	ProjectReportsPage,
	ProjectSettingsPage,
	ProjectSprintsPage,
	ProjectTimePage,
} from "./pages/project/ProjectPages.js";

// Heavy pages are code-split; My Tasks is not on the first-paint path for /login.
const MyTasksPage = lazy(() =>
	import("./pages/MyTasksPage.js").then((m) => ({ default: m.MyTasksPage })),
);

/**
 * Moves focus to the page heading on every route change for accessible
 * navigation. Targets the global page <h1> (id `tnd-page-title`), then the
 * project <h1> (id `tnd-project-title`), then the main landmark.
 */
function useFocusOnRouteChange() {
	const { pathname } = useLocation();
	useEffect(() => {
		const target =
			document.getElementById("tnd-page-title") ??
			document.getElementById("tnd-project-title") ??
			document.getElementById("tnd-main");
		target?.focus();
	}, [pathname]);
}

/**
 * Route -> layout mapping:
 *  - / redirects to /login (not /dashboard).
 *  - /welcome and /landing redirect to /login (legacy).
 *  - /login is the standalone auth page with hash deep-linking (#login,
 *    #register, #forgot, #companysetup).
 *  - GlobalLayout wraps all global routes (dashboard, projects, my-tasks, time,
 *    reports, extensions, settings, design-system). No project sub-nav.
 *  - ProjectLayout wraps /projects/:projectId/* and adds the project context bar
 *    + project sub-nav. The global nav stays present and unchanged.
 *
 * The two namespaces are disjoint, mirroring the domain navigation rules.
 */
export function App() {
	useFocusOnRouteChange();

	return (
		<AuthProvider>
			<ProjectsProvider>
				<NewProjectModalProvider>
					<Routes>
						{/* Root redirect — goes to /login, not /dashboard. */}
						<Route path="/" element={<Navigate to="/login" replace />} />

						{/* Legacy redirects. */}
						<Route path="/welcome" element={<Navigate to="/login" replace />} />
						<Route path="/landing" element={<Navigate to="/login" replace />} />

						{/* Auth — standalone, no shell chrome. */}
						<Route path="/login" element={<LoginPage />} />

						{/* Project-scoped routes — MUST precede the global catch-all so the
						    ProjectLayout owns /projects/:projectId/*. */}
						<Route path="/projects/:projectId" element={<ProjectLayout />}>
							<Route index element={<Navigate to="overview" replace />} />
							<Route path="overview" element={<ProjectOverviewPage />} />
							<Route path="backlog" element={<ProjectBacklogPage />} />
							<Route path="board" element={<ProjectBoardPage />} />
							<Route path="sprints" element={<ProjectSprintsPage />} />
							<Route path="time" element={<ProjectTimePage />} />
							<Route path="wiki" element={<ProjectDocsPage />} />
							{/* Redirect legacy /docs path to /wiki. */}
							<Route path="docs" element={<Navigate to="wiki" replace />} />
							<Route path="reports" element={<ProjectReportsPage />} />
							<Route path="settings" element={<ProjectSettingsPage />} />
						</Route>

						{/* Global routes. */}
						<Route element={<GlobalLayout />}>
							<Route path="/dashboard" element={<DashboardPage />} />
							<Route path="/projects" element={<ProjectsPage />} />
							<Route
								path="/my-tasks"
								element={
									<Suspense fallback={<span aria-live="polite" />}>
										<MyTasksPage />
									</Suspense>
								}
							/>
							<Route path="/time" element={<TimePage />} />
							<Route path="/reports" element={<ReportsPage />} />
							<Route path="/extensions" element={<ExtensionsPage />} />
							<Route path="/settings" element={<WorkspaceSettingsPage />} />
							<Route path="/settings/members" element={<WorkspaceMembersPage />} />
							<Route path="/design-system" element={<DesignSystemPage />} />
							<Route path="*" element={<NotFoundPage />} />
						</Route>
					</Routes>
				</NewProjectModalProvider>
			</ProjectsProvider>
		</AuthProvider>
	);
}
