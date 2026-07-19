import type { KeyboardEvent, ReactNode } from "react";

export interface TabItem {
	id: string;
	label: ReactNode;
	/** decorative leading icon */
	icon?: ReactNode;
	/** for route tabs: the href the app links to */
	href?: string;
	disabled?: boolean;
}

/** Render-prop the app uses to inject its router Link for ROUTE tabs. */
export type RenderTabLink = (item: TabItem, children: ReactNode, isActive: boolean) => ReactNode;

export interface TabsProps {
	items: TabItem[];
	/** id of the active tab */
	activeId: string;
	/** accessible label for the tablist */
	"aria-label": string;
	/**
	 * In-page tabs: called when a tab is selected. When provided, the list uses the
	 * ARIA tab pattern (role="tablist"/"tab", roving arrow-key focus).
	 */
	onSelect?: (id: string) => void;
	/**
	 * Route tabs: the app injects a Link via this render prop and `onSelect` is
	 * omitted. Tabs render as links with aria-current="page" for the active route
	 * (mirrors the nav components — routing stays in the app).
	 */
	renderLink?: RenderTabLink;
}

/**
 * Accessible tabs in two flavors:
 *  - in-page (pass `onSelect`): the WAI-ARIA tab pattern — role="tablist", each
 *    tab is role="tab" with aria-selected and roving tabindex; ←/→ move focus.
 *    The host renders the matching panel with role="tabpanel".
 *  - route tabs (pass `renderLink`): real navigation links with aria-current,
 *    like ProjectNavigation. Use these when each tab is a distinct route.
 */
export function Tabs({ items, activeId, onSelect, renderLink, ...rest }: TabsProps) {
	const ariaLabel = rest["aria-label"];

	// Route-tab mode: links, no tablist semantics.
	if (renderLink) {
		return (
			<nav className="tnd-tabs__list" aria-label={ariaLabel}>
				{items.map((item) => {
					const isActive = item.id === activeId;
					const content = (
						<>
							{item.icon ? (
								<span aria-hidden="true" style={{ display: "inline-flex", marginRight: 6 }}>
									{item.icon}
								</span>
							) : null}
							{item.label}
						</>
					);
					return <span key={item.id}>{renderLink(item, content, isActive)}</span>;
				})}
			</nav>
		);
	}

	// In-page tab mode: ARIA tab pattern with roving focus.
	const enabled = items.filter((i) => !i.disabled);
	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (!onSelect) return;
		if (
			event.key !== "ArrowRight" &&
			event.key !== "ArrowLeft" &&
			event.key !== "Home" &&
			event.key !== "End"
		) {
			return;
		}
		event.preventDefault();
		const idx = enabled.findIndex((i) => i.id === activeId);
		let next = idx;
		if (event.key === "ArrowRight") next = (idx + 1) % enabled.length;
		else if (event.key === "ArrowLeft") next = (idx - 1 + enabled.length) % enabled.length;
		else if (event.key === "Home") next = 0;
		else if (event.key === "End") next = enabled.length - 1;
		const target = enabled[next];
		if (target) onSelect(target.id);
	};

	return (
		<div className="tnd-tabs__list" role="tablist" aria-label={ariaLabel} onKeyDown={onKeyDown}>
			{items.map((item) => {
				const isActive = item.id === activeId;
				return (
					<button
						key={item.id}
						type="button"
						role="tab"
						id={`tnd-tab-${item.id}`}
						className="tnd-tab"
						aria-selected={isActive}
						aria-controls={`tnd-tabpanel-${item.id}`}
						tabIndex={isActive ? 0 : -1}
						disabled={item.disabled}
						onClick={onSelect ? () => onSelect(item.id) : undefined}
					>
						{item.icon ? (
							<span aria-hidden="true" style={{ display: "inline-flex", marginRight: 6 }}>
								{item.icon}
							</span>
						) : null}
						{item.label}
					</button>
				);
			})}
		</div>
	);
}
