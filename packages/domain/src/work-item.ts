/**
 * The unified WorkItem model — the spine of Tundra.
 *
 * Every assignable thing (task, checklist item, bug, review, docs follow-up,
 * automation action, extension-provided action) is materialized into a single
 * `WorkItem` row carrying a `sourceRef` back to its origin. "My Tasks" is one
 * query over this read model; it never reads source tables directly.
 *
 * See architect report 01 §2–§3 and ADR-0003.
 */

import type {
	Entity,
	ISODateString,
	ModuleId,
	ProjectId,
	SprintId,
	UserId,
	WorkItemId,
} from "./ids.js";
import type { WorkItemPriority, WorkItemSource, WorkItemStatus } from "./enums.js";

/** Stable back-reference to the entity that produced this WorkItem. */
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
