/**
 * "My Tasks" aggregation — a pure function over the unified WorkItem read model.
 *
 * The rule (architect report 01 §3, ADR-0003): "My Tasks" is a single selection
 * over `WorkItem`s filtered by `assigneeId` and, by default, excluding terminal
 * statuses (Done, Cancelled). It never inspects source tables. Optional narrowing
 * by project and by source type is supported.
 */

import type { ProjectId, UserId } from "./ids.js";
import { WorkItemStatus } from "./enums.js";
import type { WorkItemSource } from "./enums.js";
import type { WorkItem } from "./work-item.js";

export interface MyTasksFilter {
	assigneeId: UserId;
	/** optional narrowing to a single project */
	projectId?: ProjectId;
	/** default: every status except Done/Cancelled */
	includeStatuses?: WorkItemStatus[];
	/** optional narrowing to specific source types */
	sources?: WorkItemSource[];
}

/** A status is "active" when it is neither Done nor Cancelled. */
export function isActiveStatus(s: WorkItemStatus): boolean {
	return s !== WorkItemStatus.Done && s !== WorkItemStatus.Cancelled;
}

/**
 * Select the WorkItems that belong in a user's "My Tasks" view.
 *
 * Filtering order:
 *  1. must be assigned to `filter.assigneeId`
 *  2. status: if `includeStatuses` is given, the status must be in it; otherwise
 *     only active statuses (not Done/Cancelled) are kept
 *  3. if `projectId` is given, must match
 *  4. if `sources` is given, the source must be in it
 *
 * Pure and order-preserving: the returned array keeps the input ordering.
 */
export function selectMyTasks(items: WorkItem[], filter: MyTasksFilter): WorkItem[] {
	const statusFilter = filter.includeStatuses;
	const sourceFilter = filter.sources;

	return items.filter((item) => {
		if (item.assigneeId !== filter.assigneeId) {
			return false;
		}
		if (statusFilter) {
			if (!statusFilter.includes(item.status)) {
				return false;
			}
		} else if (!isActiveStatus(item.status)) {
			return false;
		}
		if (filter.projectId !== undefined && item.projectId !== filter.projectId) {
			return false;
		}
		if (sourceFilter && !sourceFilter.includes(item.source)) {
			return false;
		}
		return true;
	});
}
