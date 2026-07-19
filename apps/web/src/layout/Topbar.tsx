import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { Avatar, Icon, IconButton, Logo, ThemeToggle } from "@tundra/ui";

import { LanguageSwitcher } from "../components/LanguageSwitcher.js";
import { useNewProjectModal } from "../components/NewProjectModalContext.js";
import { ME } from "../data/index.js";

export interface Crumb {
	label: string;
	/** when present and not the last crumb, renders as a link */
	href?: string;
}

export interface TopbarProps {
	/** breadcrumb trail, e.g. Projects / Aurora Platform / Board */
	breadcrumbs: Crumb[];
	/** context-aware search placeholder hint */
	searchScope: string;
}

/**
 * The app banner content rendered inside AppShell's <header role="banner">:
 * brand mark (logo + wordmark linking home), a context breadcrumb, a
 * context-aware search affordance with a command-palette (⌘K) hint, a
 * notifications bell (with the orange unread dot), and the current user.
 *
 * Routing-aware (it uses react-router Link), so it lives in the app, not in
 * @tundra/ui. Composed and passed to AppShell via the `topbar` slot.
 */
export function Topbar({ breadcrumbs, searchScope }: TopbarProps) {
	const { t } = useTranslation();
	const { open: openNewProjectModal } = useNewProjectModal();
	return (
		<>
			<Link to="/dashboard" className="tnd-topbar__brand" aria-label={t("topbar.brandLabel")}>
				<Logo size={26} />
				<span>Tundra</span>
			</Link>

			<nav className="tnd-topbar__breadcrumb" aria-label={t("shell.breadcrumbLabel")}>
				<ol className="tnd-topbar__breadcrumb-list">
					{breadcrumbs.map((crumb, index) => {
						const isLast = index === breadcrumbs.length - 1;
						return (
							<li key={`${crumb.label}-${index}`}>
								{crumb.href && !isLast ? (
									<Link to={crumb.href}>{crumb.label}</Link>
								) : (
									<span aria-current={isLast ? "page" : undefined}>{crumb.label}</span>
								)}
								{!isLast ? (
									<span className="tnd-topbar__breadcrumb-sep" aria-hidden="true">
										{" / "}
									</span>
								) : null}
							</li>
						);
					})}
				</ol>
			</nav>

			<span className="tnd-topbar__spacer" />

			<button type="button" className="tnd-topbar__search">
				<Icon name="search" size={16} aria-hidden />
				<span>{searchScope}</span>
				<span className="tnd-topbar__search-hint" aria-hidden="true">
					<kbd className="tnd-topbar__kbd">⌘</kbd>
					<kbd className="tnd-topbar__kbd">K</kbd>
				</span>
			</button>

			<div className="tnd-topbar__actions">
				<LanguageSwitcher />
				<ThemeToggle
					labelSwitchToDark={t("theme.switchToDark")}
					labelSwitchToLight={t("theme.switchToLight")}
				/>
				<IconButton label={t("topbar.newProject")} onClick={openNewProjectModal}>
					<Icon name="plus" />
				</IconButton>
				<IconButton label={t("topbar.notifications", { count: 3 })} hasDot>
					<Icon name="bell" />
				</IconButton>
				<Avatar name={ME.name} />
			</div>
		</>
	);
}
