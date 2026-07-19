# Domain Model

The canonical domain model lives in `@tundra/domain` (`packages/domain/src`). It
is pure: type declarations and pure functions, no I/O, no framework. Everything
else in Tundra — `db`, `api`, `worker`, `ui`, modules — is expressed in these
terms. The shapes below are the real, shipped contracts; they are the source of
truth.

The unified `WorkItem` itself is documented in detail in
[work-item-model.md](./work-item-model.md); this document covers the full entity
set and the shared conventions.

---

## Conventions

### Branded ids

Every entity id is a **branded string type**. At runtime an id is a plain string;
at compile time the brand prevents passing, for example, a `ProjectId` where a
`TaskId` is expected. From `packages/domain/src/ids.ts`:

```ts
export type Id<TBrand extends string> = string & { readonly __brand: TBrand };

export type WorkspaceId = Id<"Workspace">;
export type ProjectId = Id<"Project">;
export type UserId = Id<"User">;
export type ModuleId = Id<"Module">;
export type WorkItemId = Id<"WorkItem">;
export type TaskId = Id<"Task">;
export type UserStoryId = Id<"UserStory">;
export type ChecklistItemId = Id<"ChecklistItem">;
export type SprintId = Id<"Sprint">;
export type TimeEntryId = Id<"TimeEntry">;
export type DocPageId = Id<"DocPage">;
export type DiscussionId = Id<"Discussion">;
export type ReportId = Id<"Report">;
export type AutomationId = Id<"AutomationAction">;
```

### ISO date strings and the base entity

All timestamps are ISO 8601 strings. Every persisted entity carries an id and
audit timestamps via the shared `Entity` base:

```ts
/** ISO 8601 timestamp string, e.g. "2026-06-27T12:00:00.000Z". */
export type ISODateString = string;

export interface Entity<TId> {
	id: TId;
	createdAt: ISODateString;
	updatedAt: ISODateString;
}
```

### Enum string values are part of the contract

The enum string values are consumed across packages — as `db` column values,
GraphQL enum values, and fixtures. They must not change without a coordinated
migration. From `packages/domain/src/enums.ts`:

```ts
export enum ProjectRole {
	Owner = "owner",
	Admin = "admin",
	Member = "member",
	Viewer = "viewer",
}

export enum WorkItemSource {
	Task = "task",
	StoryChecklist = "story_checklist",
	Subtask = "subtask",
	Bug = "bug",
	Review = "review",
	Docs = "docs",
	Automation = "automation",
	Extension = "extension",
}

export enum WorkItemStatus {
	Todo = "todo",
	InProgress = "in_progress",
	Blocked = "blocked",
	Done = "done",
	Cancelled = "cancelled",
}

export enum WorkItemPriority {
	Low = "low",
	Medium = "medium",
	High = "high",
	Urgent = "urgent",
}

export enum ExtensionPointKind {
	NavEntry = "nav.entry",
	DashboardWidget = "dashboard.widget",
	TaskDrawerPanel = "task.drawer.panel",
	SettingsPanel = "settings.panel",
	WorkItemProvider = "workitem.provider",
	PermissionHook = "permission.hook",
}
```

The database mirrors these as Postgres enums whose values are sourced directly
from the domain enums (`packages/db/src/schema/enums.ts`), so the database can
never drift from the domain contract.

---

## Workspace, Project, membership

From `packages/domain/src/entities.ts`:

```ts
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
```

- A **workspace** is the top-level container and the unit of module activation.
- A **project** belongs to exactly one workspace and activates a subset of the
  workspace's modules. Everything project-scoped (tasks, stories, docs, work
  items, navigation) hangs off a `ProjectId`.
- **Membership** is a `(projectId, userId)` pair with a `ProjectRole`
  (`owner | admin | member | viewer`).

---

## Modules, manifest, extension points

```ts
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
```

A **`ModuleManifest`** is the static declaration a module ships: what it
contributes, what permissions it needs, and which `WorkItemSource` types it
provides. The host trusts the manifest to know which extension points a module
touches. See [module-system.md](./module-system.md) for the registry, the named
slots, and the scope-validation rule.

---

## The unified WorkItem

```ts
export interface WorkItemSourceRef {
	source: WorkItemSource;
	/** Id of the originating entity (TaskId, ChecklistItemId, …) as a string. */
	refId: string;
	/** Optional module id when source is Extension/Automation. */
	moduleId?: ModuleId;
}

export interface WorkItem extends Entity<WorkItemId> {
	/** every WorkItem is project-scoped */
	projectId: ProjectId;
	/** discriminator: type of the originating entity */
	source: WorkItemSource;
	/** link back to origin */
	sourceRef: WorkItemSourceRef;
	title: string;
	status: WorkItemStatus;
	priority: WorkItemPriority;
	/** drives "My Tasks" aggregation */
	assigneeId?: UserId;
	dueDate?: ISODateString;
	sprintId?: SprintId;
	/** free-form module/provider payload; the host treats it as opaque for display */
	metadata?: Record<string, unknown>;
}
```

`WorkItem` is the spine of the product. The `source` is a **discriminator over the
originating entity type, never a UI layout variant** — every WorkItem renders the
same way. `sourceRef` is the stable back-reference to the origin. See
[work-item-model.md](./work-item-model.md) for the full model and the "My Tasks"
aggregation rule.

---

## Source entities

These are the entities that produce WorkItems. Each carries an `assigneeId` and a
`status` (or an equivalent) so it can be materialized into the unified read model.

```ts
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

export interface Discussion extends Entity<DiscussionId> {
	projectId: ProjectId;
	title: string;
	body: string;
	authorId: UserId;
	resolved: boolean;
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
```

Notes:

- A **Task** with a `parentTaskId` is a subtask; it materializes as a WorkItem
  with `source: subtask` (otherwise `source: task`).
- A **UserStory** decomposes into ordered **ChecklistItem**s. An assigned
  checklist item surfaces in its assignee's "My Tasks" as a WorkItem with
  `source: story_checklist` — this is a defining product rule.
- **TimeEntry** can attach to any WorkItem, regardless of its source.
- **Report** carries a generic `spec`; the worker computes rollups.
- **AutomationAction** produces WorkItems with `source: automation` (or
  `extension` when a module's `moduleId` is set).

`Bug`, `Review`, and documentation follow-ups are intentionally **not** core
tables. They are contributed by modules through `WorkItemProvider`s and surface as
WorkItems with `source: bug | review | docs`. This keeps the core small while the
extension seam is exercised from day one (see
[module-system.md](./module-system.md)).

---

## Persistence mapping

The starter Drizzle schema (`packages/db/src/schema/tables.ts`) covers the core
tables — `workspaces`, `projects`, `project_members`, `modules`, `work_items` —
mapping 1:1 to the domain shapes (text ids, `timestamptz` audit columns in string
mode, `jsonb` for `enabledModuleIds`, `sourceRef`, and `metadata`). Source-entity
tables and indexes are deferred. Migrations are generated from this schema; see
[deployment-plan.md](./deployment-plan.md).
