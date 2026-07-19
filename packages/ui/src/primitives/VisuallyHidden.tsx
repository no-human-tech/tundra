import type { ReactNode } from "react";

export interface VisuallyHiddenProps {
	children: ReactNode;
	/** render as a different element when needed (default span) */
	as?: "span" | "div";
}

/**
 * Content that is removed from the visual layout but remains available to
 * assistive technology. Pairs icons/colors with an accessible text label.
 */
export function VisuallyHidden({ children, as: Tag = "span" }: VisuallyHiddenProps) {
	return <Tag className="tnd-visually-hidden">{children}</Tag>;
}
