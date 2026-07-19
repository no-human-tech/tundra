import type { ReactNode } from "react";

import { WorkItemPriority } from "@tundra/domain";
import type { WorkItemSource, WorkItemStatus } from "@tundra/domain";

import { Avatar } from "../primitives/Avatar.js";
import { Chip } from "../primitives/Chip.js";
import { StatusDot, statusLabel } from "../primitives/StatusDot.js";
import type { WorkItemView } from "../types.js";
import { ModuleBadge } from "./ModuleBadge.js";

/**
 * Optional resolvers that translate the per-row enum text without the app reaching
 * into component internals. Each resolver defaults to the current English
 * behavior, so omitting `labels` leaves existing callers unchanged.
 */
export interface WorkItemLabels {
	/** visible source-badge label; defaults to ModuleBadge's SOURCE_BADGE_MAP/moduleLabel behavior */
	source?: (source: WorkItemSource, item: WorkItemView) => string;
	/** visible/accessible status text; defaults to statusLabel(status) */
	status?: (status: WorkItemStatus) => string;
	/** visible priority chip text; defaults to the current English priority text */
	priority?: (priority: WorkItemPriority) => string;
	/** formats the due line from the (already date-sliced) value; defaults to `Due ${date}` */
	due?: (date: string) => string;
}

export interface WorkItemRowProps {
	item: WorkItemView;
	selected?: boolean;
	/** opens the task drawer for this item */
	onOpen?: (id: string) => void;
	/** override the source badge if a module needs to (defaults to <ModuleBadge/>) */
	renderSourceBadge?: (item: WorkItemView) => ReactNode;
	/** translate the per-row enum text (source/status/priority/due) without internals */
	labels?: WorkItemLabels;
}

const PRIORITY_TONE = {
	[WorkItemPriority.Low]: "neutral",
	[WorkItemPriority.Medium]: "info",
	[WorkItemPriority.High]: "warning",
	[WorkItemPriority.Urgent]: "danger",
} as const;

const PRIORITY_LABEL = {
	[WorkItemPriority.Low]: "Low",
	[WorkItemPriority.Medium]: "Medium",
	[WorkItemPriority.High]: "High",
	[WorkItemPriority.Urgent]: "Urgent",
} as const;

function formatDue(iso: string): string {
	// Deterministic, locale-independent short date for display + tests.
	return iso.slice(0, 10);
}

/**
 * The canonical "My Tasks" element. A single row layout for EVERY source — the
 * source is expressed purely as metadata via <ModuleBadge/>; the component never
 * branches its layout on `item.source`. One full-row button is the single
 * interactive control (Enter/Space opens the drawer).
 *
 * Structure: <li> with one <button> laid out as
 *   [status] [title + meta] [source badge · priority · assignee]
 * See product-designer report 02 §2 (WorkItemRow recommendation) and §4.
 */
export function WorkItemRow({
	item,
	selected = false,
	onOpen,
	renderSourceBadge,
	labels,
}: WorkItemRowProps) {
	const rowClass = ["tnd-workitem-row", selected ? "tnd-workitem-row--selected" : ""]
		.filter(Boolean)
		.join(" ");

	const statusText = labels?.status ? labels.status(item.status) : statusLabel(item.status);
	const sourceLabel = labels?.source ? labels.source(item.source, item) : undefined;

	const badge = renderSourceBadge ? (
		renderSourceBadge(item)
	) : (
		<ModuleBadge
			source={item.source}
			moduleLabel={item.moduleLabel}
			label={sourceLabel}
			size="sm"
		/>
	);

	return (
		<li className={rowClass}>
			<button
				type="button"
				className="tnd-workitem-row__button"
				aria-current={selected ? "true" : undefined}
				onClick={onOpen ? () => onOpen(item.id) : undefined}
			>
				<StatusDot status={item.status} label={statusText} />

				<span className="tnd-workitem-row__main">
					<span className="tnd-workitem-row__title">{item.title}</span>
					<span className="tnd-workitem-row__meta">
						{item.reference ? (
							<span className="tnd-workitem-row__ref">{item.reference}</span>
						) : null}
						<span>{item.projectName}</span>
						<span aria-hidden="true">·</span>
						<span>{statusText}</span>
						{item.dueAt ? (
							<>
								<span aria-hidden="true">·</span>
								<span>
									{labels?.due ? labels.due(formatDue(item.dueAt)) : `Due ${formatDue(item.dueAt)}`}
								</span>
							</>
						) : null}
					</span>
				</span>

				<span className="tnd-workitem-row__aside">
					{badge}
					{item.priority ? (
						<Chip tone={PRIORITY_TONE[item.priority]}>
							{labels?.priority ? labels.priority(item.priority) : PRIORITY_LABEL[item.priority]}
						</Chip>
					) : null}
					{item.assignee ? (
						<span className="tnd-workitem-row__assignee">
							<Avatar name={item.assignee.name} avatarUrl={item.assignee.avatarUrl} />
						</span>
					) : null}
				</span>
			</button>
		</li>
	);
}

export interface WorkItemListProps {
	items: WorkItemView[];
	selectedId?: string;
	onOpen?: (id: string) => void;
	/** accessible label for the list (e.g. "My Tasks") */
	"aria-label"?: string;
	/** translate per-row enum text; forwarded verbatim to every WorkItemRow */
	labels?: WorkItemLabels;
}

/**
 * A semantic list wrapper around WorkItemRow. Renders <ul role="list"> so every
 * source is visually and structurally identical — one layout, source-as-metadata.
 * `labels` is forwarded to each row so the app translates enum text in one place.
 */
export function WorkItemList({
	items,
	selectedId,
	onOpen,
	"aria-label": ariaLabel,
	labels,
}: WorkItemListProps) {
	return (
		<ul className="tnd-workitem-list" role="list" aria-label={ariaLabel}>
			{items.map((item) => (
				<WorkItemRow
					key={item.id}
					item={item}
					selected={item.id === selectedId}
					onOpen={onOpen}
					labels={labels}
				/>
			))}
		</ul>
	);
}
