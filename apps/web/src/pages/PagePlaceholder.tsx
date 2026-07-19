import type { ReactNode } from "react";

export interface PagePlaceholderProps {
	title: string;
	lead?: string;
	/** scope hint shown as context; demonstrates shared page primitives */
	children?: ReactNode;
}

/**
 * Lightweight placeholder page. Renders a single <h1> as the page-heading anchor
 * (focus-managed on route change). Global and project pages reuse this primitive;
 * the menus differ, the page shell is shared (report 02 §3).
 */
export function PagePlaceholder({ title, lead, children }: PagePlaceholderProps) {
	return (
		<section aria-labelledby="tnd-page-title">
			<h1 id="tnd-page-title" className="tnd-page__title" tabIndex={-1}>
				{title}
			</h1>
			{lead ? <p className="tnd-page__lead">{lead}</p> : null}
			{children}
		</section>
	);
}
