/**
 * Builds the `@tundra/ui` `WorkItemLabels` resolver object from the active
 * translations, so every `WorkItemRow` / `WorkItemList` renders translated
 * source / status / priority / due text WITHOUT the app reaching into the
 * component internals (the Phase-1 override contract).
 *
 * The translated source flows into ModuleBadge's visible label; the `data-source`
 * attribute and per-source color/icon mapping are untouched — the
 * source-as-metadata invariant is preserved. For extension/automation sources
 * that carry a contributing `moduleLabel`, we keep showing that module name
 * (it is data, not chrome).
 */

import { WorkItemSource } from "@tundra/domain";
import type { WorkItemPriority, WorkItemStatus } from "@tundra/domain";
import type { TFunction } from "i18next";
import type { WorkItemLabels, WorkItemView } from "@tundra/ui";

/** Resolve the translated, human source label for a work item. */
export function sourceLabel(t: TFunction, source: WorkItemSource, item?: WorkItemView): string {
	const usesModuleLabel =
		(source === WorkItemSource.Extension || source === WorkItemSource.Automation) &&
		Boolean(item?.moduleLabel);
	if (usesModuleLabel) return item!.moduleLabel as string;
	return t(`workItem.source.${source}` as never);
}

/** Resolve the translated status label. */
export function statusText(t: TFunction, status: WorkItemStatus): string {
	return t(`workItem.status.${status}` as never);
}

/** Resolve the translated priority label (full form). */
export function priorityText(t: TFunction, priority: WorkItemPriority): string {
	return t(`workItem.priority.${priority}` as never);
}

/** Resolve the translated short priority label (board/kanban chips). */
export function priorityShort(t: TFunction, priority: WorkItemPriority): string {
	return t(`workItem.priorityShort.${priority}` as never);
}

/**
 * The single `WorkItemLabels` object passed to `WorkItemList` / `WorkItemRow`.
 * Translates source, status, priority, and the due-date prefix.
 */
export function workItemLabels(t: TFunction): WorkItemLabels {
	return {
		source: (source, item) => sourceLabel(t, source, item),
		status: (status) => statusText(t, status),
		priority: (priority) => priorityText(t, priority),
		due: (date) => t("workItem.due", { date }),
	};
}
