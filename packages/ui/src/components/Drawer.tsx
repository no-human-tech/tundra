import { useEffect, useRef } from "react";
import type { KeyboardEvent, ReactNode } from "react";

import { Icon } from "../primitives/Icon.js";
import { IconButton } from "../primitives/IconButton.js";

export interface DrawerProps {
	/** controls mount/visibility */
	open: boolean;
	/** called on Esc, overlay click, or the close button */
	onClose: () => void;
	/** accessible title; rendered as the drawer heading and the dialog's a11y name */
	title: ReactNode;
	/** optional sub-line under the title (e.g. "Aurora · Board · In Progress") */
	subtitle?: ReactNode;
	/** content shown to the LEFT of the close button on the top line (badges, etc.) */
	topMeta?: ReactNode;
	/** extra icon actions placed before the close button (e.g. copy link) */
	headerActions?: ReactNode;
	/** optional tab bar rendered below the header (e.g. a <Tabs/> in route or panel mode) */
	tabs?: ReactNode;
	/** main scrollable body */
	children: ReactNode;
	/** narrower width preset */
	size?: "md" | "sm";
	/** accessible name for the close button (e.g. translated); defaults to "Close" */
	closeLabel?: string;
}

const FOCUSABLE =
	'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A right-side slide-over dialog (the task drawer). Accessibility:
 *  - role="dialog" + aria-modal, labeled by its title.
 *  - Esc and overlay-click close it.
 *  - Focus moves into the drawer on open and is restored to the previously
 *    focused element on close; Tab/Shift+Tab are trapped within the panel.
 *  - Honors prefers-reduced-motion via the global guard (animation neutralized).
 *
 * Presentational: it does not fetch or route. For the task drawer's tabbed body,
 * pass a <Tabs/> via `tabs` and render the active panel as `children`.
 */
export function Drawer({
	open,
	onClose,
	title,
	subtitle,
	topMeta,
	headerActions,
	tabs,
	children,
	size = "md",
	closeLabel = "Close",
}: DrawerProps) {
	const panelRef = useRef<HTMLDivElement>(null);
	const restoreRef = useRef<HTMLElement | null>(null);
	const titleId = useRef(`tnd-drawer-title-${Math.random().toString(36).slice(2)}`).current;

	// Move focus in on open; restore it on close.
	useEffect(() => {
		if (!open) return;
		restoreRef.current = (document.activeElement as HTMLElement) ?? null;
		const panel = panelRef.current;
		if (panel) {
			const first = panel.querySelector<HTMLElement>(FOCUSABLE);
			(first ?? panel).focus();
		}
		return () => {
			restoreRef.current?.focus?.();
		};
	}, [open]);

	if (!open) return null;

	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.key === "Escape") {
			event.stopPropagation();
			onClose();
			return;
		}
		if (event.key !== "Tab") return;
		const panel = panelRef.current;
		if (!panel) return;
		const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
			(el) => el.offsetParent !== null || el === document.activeElement,
		);
		if (focusables.length === 0) {
			event.preventDefault();
			panel.focus();
			return;
		}
		const first = focusables[0]!;
		const last = focusables[focusables.length - 1]!;
		const active = document.activeElement as HTMLElement | null;
		if (event.shiftKey && (active === first || active === panel)) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && active === last) {
			event.preventDefault();
			first.focus();
		}
	};

	return (
		<>
			<div className="tnd-drawer__overlay" onClick={onClose} aria-hidden="true" />
			<div
				ref={panelRef}
				className={["tnd-drawer", "tnd-scroll", size === "sm" ? "tnd-drawer--sm" : ""]
					.filter(Boolean)
					.join(" ")}
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				tabIndex={-1}
				onKeyDown={onKeyDown}
			>
				<div className="tnd-drawer__header">
					<div className="tnd-drawer__topline">
						{topMeta}
						<span className="tnd-drawer__topline-actions">
							{headerActions}
							<IconButton label={closeLabel} onClick={onClose}>
								<Icon name="close" />
							</IconButton>
						</span>
					</div>
					<h2 id={titleId} className="tnd-drawer__title">
						{title}
					</h2>
					{subtitle ? <p className="tnd-drawer__subtitle">{subtitle}</p> : null}
				</div>

				{tabs ? <div className="tnd-drawer__tabs">{tabs}</div> : null}

				<div className="tnd-drawer__body">{children}</div>
			</div>
		</>
	);
}
