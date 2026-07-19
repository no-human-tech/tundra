import type { ReactNode } from "react";

export interface EmptyStateProps {
	/** decorative icon shown in a soft tile above the title */
	icon?: ReactNode;
	title: string;
	description?: ReactNode;
	/** a single primary action (e.g. <Button variant="accent">…</Button>) */
	action?: ReactNode;
}

/**
 * A centered "nothing here yet" panel for empty lists, queues, and reports.
 * Presentational only: pass an icon, title, optional description, and an action.
 */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
	return (
		<div className="tnd-emptystate">
			{icon ? (
				<span className="tnd-emptystate__icon" aria-hidden="true">
					{icon}
				</span>
			) : null}
			<p className="tnd-emptystate__title">{title}</p>
			{description ? <p className="tnd-emptystate__description">{description}</p> : null}
			{action ? <div className="tnd-emptystate__action">{action}</div> : null}
		</div>
	);
}
