import type { ReactNode } from "react";

import { WorkItemPriority } from "@tundra/domain";

import { Avatar } from "../primitives/Avatar.js";
import { Badge } from "../primitives/Badge.js";

export interface KanbanCardData {
	id: string;
	/** human reference, e.g. "AUR-119" */
	reference?: string;
	title: string;
	priority?: WorkItemPriority;
	/** orange left-bar + BLOCKED badge */
	blocked?: boolean;
	/** story points / estimate */
	points?: number;
	assigneeName?: string;
	assigneeAvatarUrl?: string;
	/** small labels/tags shown above the footer */
	labels?: ReactNode;
	/** comment count shown in the footer */
	comments?: number;
}

export interface KanbanCardProps {
	card: KanbanCardData;
	onOpen?: (id: string) => void;
	/** visible priority text (e.g. translated); defaults to the current English short labels */
	priorityLabel?: (priority: WorkItemPriority) => string;
	/** visible "blocked" badge text (e.g. translated); defaults to "Blocked" */
	blockedLabel?: string;
	/** formats the points/estimate footer (e.g. translated unit); defaults to `${points} pts` */
	pointsLabel?: (points: number) => string;
}

const PRIORITY_LABEL: Record<WorkItemPriority, string> = {
	[WorkItemPriority.Low]: "Low",
	[WorkItemPriority.Medium]: "Med",
	[WorkItemPriority.High]: "High",
	[WorkItemPriority.Urgent]: "Urgent",
};

/**
 * A board card. The left accent bar is orange for urgent/blocked, amber for high,
 * neutral for low (data-driven via CSS), so urgency reads at a glance AND is
 * stated as text (priority label + BLOCKED badge) — never color alone. The whole
 * card is a single button that opens the task drawer.
 */
export function KanbanCard({
	card,
	onOpen,
	priorityLabel,
	blockedLabel = "Blocked",
	pointsLabel,
}: KanbanCardProps) {
	return (
		<li>
			<button
				type="button"
				className="tnd-kanban-card"
				data-priority={card.priority}
				data-blocked={card.blocked ? "true" : undefined}
				onClick={onOpen ? () => onOpen(card.id) : undefined}
			>
				<div className="tnd-kanban-card__meta">
					{card.priority ? (
						<Badge tone="neutral">
							{priorityLabel ? priorityLabel(card.priority) : PRIORITY_LABEL[card.priority]}
						</Badge>
					) : null}
					{card.blocked ? (
						<Badge tone="accent" uppercase>
							{blockedLabel}
						</Badge>
					) : null}
					{card.reference ? <span className="tnd-kanban-card__id">{card.reference}</span> : null}
				</div>
				<div className="tnd-kanban-card__title">{card.title}</div>
				{card.labels ? <div className="tnd-kanban-card__meta">{card.labels}</div> : null}
				<div className="tnd-kanban-card__footer">
					{card.assigneeName ? (
						<Avatar name={card.assigneeName} avatarUrl={card.assigneeAvatarUrl} size="sm" />
					) : null}
					{typeof card.points === "number" ? (
						<span className="tnd-kanban-card__points">
							{pointsLabel ? pointsLabel(card.points) : `${card.points} pts`}
						</span>
					) : null}
				</div>
			</button>
		</li>
	);
}

export interface KanbanColumnProps {
	/** column name, e.g. "In Progress" */
	name: string;
	/** card count shown next to the name */
	count?: number;
	/** accent dot/count color hint via CSS var (defaults to brand) */
	accentColor?: string;
	/** trailing header control (e.g. a "more" menu) */
	headerAction?: ReactNode;
	children: ReactNode;
}

/**
 * A board column: a header (status dot + name + count) above a sunken track that
 * holds KanbanCards (render them as the children, wrapped in this column's list).
 */
export function KanbanColumn({
	name,
	count,
	accentColor,
	headerAction,
	children,
}: KanbanColumnProps) {
	const dotStyle = accentColor ? { background: accentColor } : undefined;
	return (
		<section className="tnd-kanban-col" aria-label={name}>
			<div className="tnd-kanban-col__head">
				<span className="tnd-kanban-col__dot" style={dotStyle} aria-hidden="true" />
				<span className="tnd-kanban-col__name">{name}</span>
				{typeof count === "number" ? (
					<span
						className="tnd-kanban-col__count"
						style={accentColor ? { color: accentColor } : undefined}
					>
						{count}
					</span>
				) : null}
				{headerAction ? <span style={{ marginLeft: "auto" }}>{headerAction}</span> : null}
			</div>
			<ul className="tnd-kanban-col__body">{children}</ul>
		</section>
	);
}
