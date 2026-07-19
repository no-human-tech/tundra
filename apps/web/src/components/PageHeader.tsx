import type { ReactNode } from "react";

export interface PageHeaderProps {
	/** the single <h1> for the page; receives the focus-managed anchor id */
	title: string;
	/** optional mono kicker shown above the title */
	kicker?: ReactNode;
	/** supporting lead paragraph under the title */
	lead?: ReactNode;
	/** end-aligned actions (buttons) on the title row */
	actions?: ReactNode;
}

/**
 * Standard global-page header: a single focus-managed <h1> (id `tnd-page-title`,
 * tabIndex -1 — the route-change focus target), an optional kicker + lead, and
 * trailing actions. Every global page renders exactly one of these.
 */
export function PageHeader({ title, kicker, lead, actions }: PageHeaderProps) {
	return (
		<header className="tnd-pagehead">
			<div className="tnd-pagehead__text">
				{kicker ? <p className="tnd-kicker tnd-pagehead__kicker">{kicker}</p> : null}
				<h1 id="tnd-page-title" className="tnd-page__title" tabIndex={-1}>
					{title}
				</h1>
				{lead ? <p className="tnd-page__lead tnd-pagehead__lead">{lead}</p> : null}
			</div>
			{actions ? <div className="tnd-pagehead__actions">{actions}</div> : null}
		</header>
	);
}
