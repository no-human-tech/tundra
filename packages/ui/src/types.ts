/**
 * View-layer types for the Tundra design system.
 *
 * The canonical domain model lives in `@tundra/domain` and is the single source
 * of truth. `@tundra/ui` does NOT redefine the source/status/priority enums; it
 * imports them. `WorkItemView` is a presentation-only enrichment of the domain
 * `WorkItem` that carries pre-resolved, display-ready fields (project key/name,
 * a human reference, an assignee with a name, an extension module label) so the
 * presentational components stay free of data fetching.
 *
 * See product-designer report 02 §2 and §7.
 */

import type { ReactNode } from "react";

import type { WorkItemPriority, WorkItemSource, WorkItemStatus } from "@tundra/domain";

/** Minimal navigation entry consumed by the nav components (presentational). */
export interface NavItem {
	/** stable key (matches domain NavEntryDef.key where applicable) */
	id: string;
	label: string;
	/** app-resolved href (project nav has :projectId already substituted) */
	href: string;
	/** optional count, e.g. My Tasks unread; rendered as text, not color-only */
	badgeCount?: number;
	/** app computes from the current route */
	isActive?: boolean;
	/** optional decorative icon rendered before the label (e.g. <Icon name="…" />) */
	icon?: ReactNode;
}

/** A display-ready assignee. */
export interface AssigneeView {
	id: string;
	name: string;
	avatarUrl?: string;
}

/**
 * Display-ready WorkItem. Reuses the domain enums for source/status/priority so
 * there is exactly one set of string values across the stack.
 */
export interface WorkItemView {
	id: string;
	title: string;
	source: WorkItemSource;
	status: WorkItemStatus;
	priority?: WorkItemPriority;
	/** project short key, e.g. "TUN" */
	projectKey: string;
	projectName: string;
	/** human reference, e.g. "TUN-142" */
	reference?: string;
	/** ISO date string */
	dueAt?: string;
	assignee?: AssigneeView;
	/** present when source === "extension"/"automation": contributing module label */
	moduleLabel?: string;
}
