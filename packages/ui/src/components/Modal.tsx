import { useEffect, useRef } from "react";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";

import { Icon } from "../primitives/Icon.js";
import { IconButton } from "../primitives/IconButton.js";

export interface ModalProps {
	/** controls mount/visibility */
	open: boolean;
	/** called on Esc, overlay click, or the close button */
	onClose: () => void;
	/** accessible title; rendered as the modal heading and the dialog's a11y name */
	title: ReactNode;
	/** main scrollable body */
	children: ReactNode;
	/** sticky, right-aligned footer content (e.g. Cancel / primary action) */
	footer?: ReactNode;
	/** width preset; `md` (520px, default) or `lg` (680px, for content-dense forms) */
	size?: "md" | "lg";
	/** accessible name for the close button (e.g. translated); defaults to "Close" */
	closeLabel?: string;
}

const FOCUSABLE =
	'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A centered, focus-trapping dialog (the generic modal shell — distinct from
 * the task drawer's side-panel `<Drawer/>`). Accessibility:
 *  - role="dialog" + aria-modal, labeled by its title.
 *  - Esc and overlay-click close it; clicks inside the panel never bubble to
 *    the overlay.
 *  - Focus moves into the panel on open and is restored to the previously
 *    focused element on close; Tab/Shift+Tab are trapped within the panel.
 *
 * Presentational only — no fetching, no routing. Compose `footer` with
 * `<Button/>`s for the Cancel / primary action row.
 */
export function Modal({
	open,
	onClose,
	title,
	children,
	footer,
	size = "md",
	closeLabel = "Close",
}: ModalProps) {
	const panelRef = useRef<HTMLDivElement>(null);
	const restoreRef = useRef<HTMLElement | null>(null);
	const titleId = useRef(`tnd-modal-title-${Math.random().toString(36).slice(2)}`).current;

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

	const stopInsideClick = (event: MouseEvent<HTMLDivElement>) => {
		event.stopPropagation();
	};

	return (
		<div className="tnd-modal__overlay" onClick={onClose} aria-hidden="false">
			<div
				ref={panelRef}
				className={["tnd-modal", "tnd-scroll", size === "lg" ? "tnd-modal--lg" : ""]
					.filter(Boolean)
					.join(" ")}
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				tabIndex={-1}
				onKeyDown={onKeyDown}
				onClick={stopInsideClick}
			>
				<div className="tnd-modal__header">
					<h2 id={titleId} className="tnd-modal__title">
						{title}
					</h2>
					<IconButton label={closeLabel} onClick={onClose}>
						<Icon name="close" />
					</IconButton>
				</div>

				<div className="tnd-modal__body">{children}</div>

				{footer ? <div className="tnd-modal__footer">{footer}</div> : null}
			</div>
		</div>
	);
}
