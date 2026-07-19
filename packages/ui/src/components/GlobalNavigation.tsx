import type { ReactNode } from "react";

import { Avatar } from "../primitives/Avatar.js";
import { Chip } from "../primitives/Chip.js";
import { Icon } from "../primitives/Icon.js";
import type { NavItem } from "../types.js";

/** Signature the app uses to inject a router Link (keeps `ui` routing-agnostic). */
export type RenderLink = (item: NavItem, children: ReactNode) => ReactNode;

/** Display-ready data for the signed-in profile card at the bottom of the rail. */
export interface GlobalNavigationProfile {
	/** the signed-in user's display name */
	name: string;
	/** secondary line, e.g. the user's workspace role ("Admin") */
	meta: string;
	avatarUrl?: string;
}

export interface GlobalNavigationProps {
	/** core global entries: Dashboard, Projects, My Tasks, Time, Reports, Extensions */
	items: NavItem[];
	/** Workspace Settings, pinned and visually separated */
	settingsItem: NavItem;
	/** module-contributed GLOBAL entries, grouped and labeled distinctly */
	moduleItems?: NavItem[];
	/** app injects its router Link; ui renders a plain <a> fallback otherwise */
	renderLink?: RenderLink;
	/** accessible name for the <nav> landmark (e.g. translated); defaults to "Global" */
	ariaLabel?: string;
	/** heading for the core global group (e.g. translated); defaults to "Global · Area" */
	workspaceGroupLabel?: string;
	/** heading for the module-contributed group (e.g. translated); defaults to "Modules" */
	modulesGroupLabel?: string;
	/** when true the nav is in icon-only mode (user-toggled) */
	collapsed?: boolean;
	/** called when the collapse toggle button is activated */
	onToggle?: () => void;
	/** accessible label for the collapse button; defaults to "Collapse sidebar" */
	collapseLabel?: string;
	/** accessible label for the expand button; defaults to "Expand sidebar" */
	expandLabel?: string;
	/**
	 * The signed-in user, rendered as a card fixed to the bottom of the rail
	 * (the design spec §6/§7.4). Omitted entirely when no one is signed in.
	 */
	profile?: GlobalNavigationProfile;
	/** heading above the profile card (e.g. translated); defaults to "Logged in" */
	profileGroupLabel?: string;
	/**
	 * Visually-hidden label for the card's settings affordance (which links to
	 * `settingsItem`); defaults to "Workspace settings".
	 */
	profileSettingsLabel?: string;
}

function NavLink({ item, renderLink }: { item: NavItem; renderLink?: RenderLink }) {
	const content = (
		<>
			{item.icon ? (
				<span className="tnd-nav__icon" aria-hidden="true">
					{item.icon}
				</span>
			) : null}
			<span className="tnd-nav__label">{item.label}</span>
			{typeof item.badgeCount === "number" && item.badgeCount > 0 ? (
				<span className="tnd-nav__count">
					<Chip tone="accent">{item.badgeCount}</Chip>
				</span>
			) : null}
		</>
	);

	if (renderLink) {
		return <>{renderLink(item, content)}</>;
	}
	return (
		<a className="tnd-nav__link" href={item.href} aria-current={item.isActive ? "page" : undefined}>
			{content}
		</a>
	);
}

/**
 * The signed-in profile card fixed to the bottom of the rail. Only the small
 * settings affordance is a real link (to `settingsItem`, the pinned Workspace
 * Settings entry) — its accessible name comes from `settingsLabel` (visually
 * hidden) since icon-only affordances must never be unlabeled. The name/role
 * text is static (not itself a link) so the card has exactly one unambiguous
 * interactive control.
 */
function ProfileCard({
	profile,
	settingsItem,
	settingsLabel,
	groupLabel,
	renderLink,
}: {
	profile: GlobalNavigationProfile;
	settingsItem: NavItem;
	settingsLabel: string;
	groupLabel: string;
	renderLink?: RenderLink;
}) {
	const settingsContent = (
		<>
			<span className="tnd-sr-only">{settingsLabel}</span>
			<Icon name="settings" size={15} aria-hidden="true" />
		</>
	);
	const settingsLinkItem: NavItem = {
		id: "profile-card-settings",
		href: settingsItem.href,
		label: settingsLabel,
		isActive: settingsItem.isActive,
	};

	return (
		<div className="tnd-nav__profile">
			<p className="tnd-nav__group-label" id="tnd-global-profile">
				{groupLabel}
			</p>
			<div className="tnd-profilecard">
				<Avatar name={profile.name} avatarUrl={profile.avatarUrl} size="sm" />
				<span className="tnd-profilecard__meta">
					<span className="tnd-profilecard__name">{profile.name}</span>
					<span className="tnd-profilecard__role">{profile.meta}</span>
				</span>
				{renderLink ? (
					renderLink(settingsLinkItem, settingsContent)
				) : (
					<a
						className="tnd-nav__link"
						href={settingsItem.href}
						aria-current={settingsItem.isActive ? "page" : undefined}
					>
						{settingsContent}
					</a>
				)}
			</div>
		</div>
	);
}

/**
 * The GLOBAL navigation surface. It is fed exclusively by global entries and is
 * structurally incapable of rendering project-scoped routes — it has no slot for
 * them. This enforces "global and project navigation must stay separate".
 *
 * Landmark: <nav aria-label="Global"> containing an unordered list of links.
 * Active route uses aria-current="page" (not color alone). See report 02 §2.
 *
 * When `collapsed` is true the rail shows icon-only mode (labels hidden visually;
 * screen-reader text is preserved via the icon tooltip / link text in the DOM).
 * The `onToggle` callback and the collapse button allow keyboard/pointer users to
 * switch modes; state is persisted by the app (e.g. in localStorage).
 */
export function GlobalNavigation({
	items,
	settingsItem,
	moduleItems,
	renderLink,
	ariaLabel = "Global",
	workspaceGroupLabel = "Global · Area",
	modulesGroupLabel = "Modules",
	collapsed = false,
	onToggle,
	collapseLabel = "Collapse sidebar",
	expandLabel = "Expand sidebar",
	profile,
	profileGroupLabel = "Logged in",
	profileSettingsLabel = "Workspace settings",
}: GlobalNavigationProps) {
	const toggleLabel = collapsed ? expandLabel : collapseLabel;
	const toggleTitle = toggleLabel;

	return (
		<nav
			className="tnd-globalnav"
			aria-label={ariaLabel}
			data-collapsed={collapsed ? "true" : undefined}
		>
			<p className="tnd-nav__group-label" id="tnd-global-workspace">
				{workspaceGroupLabel}
			</p>
			<ul className="tnd-nav__list" aria-labelledby="tnd-global-workspace">
				{items.map((item) => (
					<li key={item.id}>
						<NavLink item={item} renderLink={renderLink} />
					</li>
				))}
			</ul>

			{moduleItems && moduleItems.length > 0 ? (
				<>
					<hr className="tnd-nav__separator" />
					<p className="tnd-nav__group-label" id="tnd-global-modules">
						{modulesGroupLabel}
					</p>
					<ul className="tnd-nav__list" aria-labelledby="tnd-global-modules">
						{moduleItems.map((item) => (
							<li key={item.id}>
								<NavLink item={item} renderLink={renderLink} />
							</li>
						))}
					</ul>
				</>
			) : null}

			<hr className="tnd-nav__separator" />
			<ul className="tnd-nav__list">
				<li>
					<NavLink item={settingsItem} renderLink={renderLink} />
				</li>
			</ul>

			{onToggle ? (
				<button
					type="button"
					className="tnd-nav__collapse-btn"
					aria-label={toggleLabel}
					aria-expanded={!collapsed}
					title={toggleTitle}
					onClick={onToggle}
				>
					<span className="tnd-nav__icon" aria-hidden="true">
						{collapsed ? "›" : "‹"}
					</span>
					<span className="tnd-nav__label">{collapsed ? expandLabel : collapseLabel}</span>
				</button>
			) : null}

			{profile ? (
				<ProfileCard
					profile={profile}
					settingsItem={settingsItem}
					settingsLabel={profileSettingsLabel}
					groupLabel={profileGroupLabel}
					renderLink={renderLink}
				/>
			) : null}
		</nav>
	);
}
