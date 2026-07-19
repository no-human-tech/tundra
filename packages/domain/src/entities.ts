/**
 * Core domain entity interfaces.
 *
 * These are pure type declarations with no runtime footprint. They are the
 * single conceptual source of truth shared by db, api, worker, and ui.
 *
 * See architect report 01 §2.
 */

import type {
	AutomationId,
	ChecklistItemId,
	DocPageId,
	Entity,
	ISODateString,
	ModuleId,
	ProjectId,
	ReportId,
	SprintId,
	TaskId,
	TimeEntryId,
	UserId,
	UserStoryId,
	WorkItemId,
	WorkspaceId,
} from "./ids.js";
import type {
	ExtensionPointKind,
	ProjectRole,
	WorkItemPriority,
	WorkItemSource,
	WorkItemStatus,
} from "./enums.js";

// --- Workspace, Project, membership -------------------------------------------

export interface Workspace extends Entity<WorkspaceId> {
	name: string;
	/** url-safe, unique within the deployment */
	slug: string;
	ownerId: UserId;
	/** workspace-level module activation */
	enabledModuleIds: ModuleId[];
}

export interface Project extends Entity<ProjectId> {
	/** every project belongs to exactly one workspace */
	workspaceId: WorkspaceId;
	name: string;
	/** short prefix, e.g. "TUN" -> TUN-123 */
	key: string;
	slug: string;
	description?: string;
	/** project-level module activation (a subset of the workspace's) */
	enabledModuleIds: ModuleId[];
	archivedAt?: ISODateString;
}

export interface ProjectMember {
	projectId: ProjectId;
	userId: UserId;
	role: ProjectRole;
	joinedAt: ISODateString;
}

// --- Modules, manifest, extension points --------------------------------------

export type ExtensionSurface = "frontend" | "backend";

export interface ExtensionPoint {
	kind: ExtensionPointKind;
	surface: ExtensionSurface;
	/** Identifier the module references when contributing, e.g. "project.nav". */
	slot: string;
}

export interface ModuleManifest {
	id: ModuleId;
	name: string;
	/** semver */
	version: string;
	description: string;
	author: string;
	/** Declares which extension points this module contributes to. */
	contributes: ExtensionPoint[];
	/** Coarse capability flags the host grants; basis for permission hooks. */
	permissions: string[];
	/** Optional WorkItem source types this module owns (for providers). */
	providesWorkItemSources?: WorkItemSource[];
}

export interface Module extends Entity<ModuleId> {
	manifest: ModuleManifest;
	enabled: boolean;
}

// --- Source entities ----------------------------------------------------------

export interface Task extends Entity<TaskId> {
	projectId: ProjectId;
	title: string;
	description?: string;
	status: WorkItemStatus;
	priority: WorkItemPriority;
	assigneeId?: UserId;
	sprintId?: SprintId;
	/** unset for standalone tasks */
	storyId?: UserStoryId;
	/** present -> this Task is a subtask */
	parentTaskId?: TaskId;
	estimateHours?: number;
}

export interface UserStory extends Entity<UserStoryId> {
	projectId: ProjectId;
	title: string;
	/** "As a ... I want ... so that ..." */
	narrative?: string;
	status: WorkItemStatus;
	assigneeId?: UserId;
	sprintId?: SprintId;
	points?: number;
}

export interface ChecklistItem extends Entity<ChecklistItemId> {
	storyId: UserStoryId;
	projectId: ProjectId;
	text: string;
	done: boolean;
	/** an assigned checklist item must surface in My Tasks */
	assigneeId?: UserId;
	order: number;
}

export interface Sprint extends Entity<SprintId> {
	projectId: ProjectId;
	name: string;
	goal?: string;
	startsAt: ISODateString;
	endsAt: ISODateString;
	active: boolean;
}

export interface TimeEntry extends Entity<TimeEntryId> {
	projectId: ProjectId;
	userId: UserId;
	/** time can attach to any WorkItem */
	workItemId?: WorkItemId;
	minutes: number;
	/** date the work happened */
	spentOn: ISODateString;
	note?: string;
}

export interface DocPage extends Entity<DocPageId> {
	projectId: ProjectId;
	title: string;
	slug: string;
	/** markdown */
	body: string;
	/** tree structure for the wiki */
	parentId?: DocPageId;
	authorId: UserId;
}

export type ReportKind = "velocity" | "burndown" | "time_summary" | "throughput";

export interface Report extends Entity<ReportId> {
	projectId: ProjectId;
	name: string;
	kind: ReportKind;
	/** Query definition is intentionally generic; rollups computed by the worker. */
	spec: Record<string, unknown>;
}

export interface AutomationAction extends Entity<AutomationId> {
	projectId: ProjectId;
	/** set when produced by an extension */
	moduleId?: ModuleId;
	/** e.g. "workitem.status_changed" */
	trigger: string;
	title: string;
	assigneeId?: UserId;
	status: WorkItemStatus;
}
