/**
 * @tundra/ui — Tundra design system.
 *
 * Mint-dominant, orange-accent, semantic + accessible React primitives and
 * presentational composition shells, matching the canonical Tundra design.
 * Depends on `@tundra/domain` for shared display contracts ONLY (never on
 * `db`/`api`). All components are presentational: data in, no routing or
 * fetching. The nav/tabs components take a `renderLink`/`renderTabLink` callback
 * so the app injects its router Link.
 *
 * Styles: consumers import the CSS once at the app root —
 *   import "@tundra/ui/tokens.css";   // design tokens (:root --tnd-*)
 *   import "@tundra/ui/styles.css";    // reset + base + component styles
 *
 * Fonts: this package only sets --tnd-font-sans (Roboto) / --tnd-font-mono
 * (Roboto Mono); the @fontsource font files are imported by apps/web.
 */

// View-layer types (re-using domain enums, never redefining them).
export type { NavItem, AssigneeView, WorkItemView } from "./types.js";

// ----------------------------------------------------------------- Primitives
export { VisuallyHidden } from "./primitives/VisuallyHidden.js";
export type { VisuallyHiddenProps } from "./primitives/VisuallyHidden.js";
export { SkipLink } from "./primitives/SkipLink.js";
export type { SkipLinkProps } from "./primitives/SkipLink.js";
export { Button } from "./primitives/Button.js";
export type { ButtonProps, ButtonVariant, ButtonSize } from "./primitives/Button.js";
export { IconButton } from "./primitives/IconButton.js";
export type {
	IconButtonProps,
	IconButtonVariant,
	IconButtonSize,
} from "./primitives/IconButton.js";
export { Chip } from "./primitives/Chip.js";
export type { ChipProps, ChipTone } from "./primitives/Chip.js";
export { Badge } from "./primitives/Badge.js";
export type { BadgeProps, BadgeTone } from "./primitives/Badge.js";
export { StatusDot, statusLabel } from "./primitives/StatusDot.js";
export type { StatusDotProps } from "./primitives/StatusDot.js";
export { Avatar } from "./primitives/Avatar.js";
export type { AvatarProps, AvatarSize } from "./primitives/Avatar.js";
export { Toggle } from "./primitives/Toggle.js";
export type { ToggleProps } from "./primitives/Toggle.js";
export { Skeleton } from "./primitives/Skeleton.js";
export type { SkeletonProps, SkeletonVariant } from "./primitives/Skeleton.js";
export { Icon, ICON_NAMES } from "./primitives/Icon.js";
export type { IconProps, IconName } from "./primitives/Icon.js";
export { Logo } from "./primitives/Logo.js";
export type { LogoProps } from "./primitives/Logo.js";
export { ThemeToggle } from "./primitives/ThemeToggle.js";
export type { ThemeToggleProps } from "./primitives/ThemeToggle.js";

// ----------------------------------------------------------------------- Theme
export {
	applyTheme,
	getTheme,
	setTheme,
	toggleTheme,
	APP_THEME_STORAGE_KEY,
	THEME_CHANGE_EVENT,
} from "./theme/themeController.js";
export type { Theme } from "./theme/themeController.js";
export { useThemeSync } from "./theme/useThemeSync.js";

// ----------------------------------------------------------------- Components
export { ModuleBadge, SOURCE_BADGE_MAP } from "./components/ModuleBadge.js";
export type { ModuleBadgeProps, SourceBadgeMeta } from "./components/ModuleBadge.js";
export { WorkItemRow, WorkItemList } from "./components/WorkItemRow.js";
export type {
	WorkItemRowProps,
	WorkItemListProps,
	WorkItemLabels,
} from "./components/WorkItemRow.js";
export { GlobalNavigation } from "./components/GlobalNavigation.js";
export type {
	GlobalNavigationProps,
	GlobalNavigationProfile,
	RenderLink,
} from "./components/GlobalNavigation.js";
export { ProjectNavigation } from "./components/ProjectNavigation.js";
export type { ProjectNavigationProps } from "./components/ProjectNavigation.js";
export { ProjectHeader } from "./components/ProjectHeader.js";
export type {
	ProjectHeaderProps,
	ProjectHeaderProject,
	Breadcrumb,
} from "./components/ProjectHeader.js";
export { AppShell } from "./components/AppShell.js";
export type { AppShellProps } from "./components/AppShell.js";

export { Card, CardHeader, CardSection } from "./components/Card.js";
export type { CardProps, CardHeaderProps, CardSectionProps } from "./components/Card.js";
export { Tabs } from "./components/Tabs.js";
export type { TabsProps, TabItem, RenderTabLink } from "./components/Tabs.js";
export { Drawer } from "./components/Drawer.js";
export type { DrawerProps } from "./components/Drawer.js";
export { Modal } from "./components/Modal.js";
export type { ModalProps } from "./components/Modal.js";
export { EmptyState } from "./components/EmptyState.js";
export type { EmptyStateProps } from "./components/EmptyState.js";
export { MetricStat } from "./components/MetricStat.js";
export type { MetricStatProps, MetricStatTone } from "./components/MetricStat.js";
export { ModuleCard } from "./components/ModuleCard.js";
export type { ModuleCardProps, ModuleStatus } from "./components/ModuleCard.js";
export { ExtensionPointsRegistry, ExtensionSlot } from "./components/ExtensionPoints.js";
export type {
	ExtensionPointsRegistryProps,
	ExtensionSlotProps,
	ExtensionSlotInfo,
} from "./components/ExtensionPoints.js";
export { KanbanColumn, KanbanCard } from "./components/Kanban.js";
export type { KanbanColumnProps, KanbanCardProps, KanbanCardData } from "./components/Kanban.js";
export { Timer } from "./components/Timer.js";
export type { TimerProps } from "./components/Timer.js";
