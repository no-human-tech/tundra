/**
 * Canonical domain enums. String values are part of the public contract and are
 * consumed across packages (db column values, GraphQL enums, fixtures). Do not
 * change the string values without a coordinated migration.
 *
 * See architect report 01 §2.
 */

/** A member's role within a single project. */
export enum ProjectRole {
	Owner = "owner",
	Admin = "admin",
	Member = "member",
	Viewer = "viewer",
}

/**
 * The type of entity that originated a WorkItem. This is a data discriminator,
 * never a UI layout variant — every WorkItem renders the same way.
 */
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

/** Lifecycle status shared by WorkItems and their source entities. */
export enum WorkItemStatus {
	Todo = "todo",
	InProgress = "in_progress",
	Blocked = "blocked",
	Done = "done",
	Cancelled = "cancelled",
}

/** Relative priority for a WorkItem. */
export enum WorkItemPriority {
	Low = "low",
	Medium = "medium",
	High = "high",
	Urgent = "urgent",
}

/** The closed set of extension-point kinds a module may contribute to. */
export enum ExtensionPointKind {
	NavEntry = "nav.entry",
	DashboardWidget = "dashboard.widget",
	TaskDrawerPanel = "task.drawer.panel",
	SettingsPanel = "settings.panel",
	WorkItemProvider = "workitem.provider",
	PermissionHook = "permission.hook",
}
