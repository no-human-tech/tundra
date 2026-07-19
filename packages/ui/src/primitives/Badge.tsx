import type { ReactNode } from "react";

export type BadgeTone =
	"neutral" | "brand" | "success" | "warning" | "danger" | "info" | "ext" | "accent" | "ink";

export interface BadgeProps {
	tone?: BadgeTone;
	/** uppercase the label (for status/keyword badges like ENABLED, BLOCKED) */
	uppercase?: boolean;
	/** optional leading icon (decorative) */
	icon?: ReactNode;
	children: ReactNode;
}

/**
 * A small mono "machine" badge — versions, module statuses, counts, keywords.
 * Distinct from <Chip/> (which is the rounded sans-serif metadata label). Tone
 * maps to a token pair; meaning is always carried by the text, never color alone.
 */
export function Badge({ tone = "neutral", uppercase = false, icon, children }: BadgeProps) {
	const classes = ["tnd-badge", `tnd-badge--${tone}`, uppercase ? "tnd-badge--uppercase" : ""]
		.filter(Boolean)
		.join(" ");
	return (
		<span className={classes}>
			{icon ? (
				<span aria-hidden="true" style={{ display: "inline-flex" }}>
					{icon}
				</span>
			) : null}
			{children}
		</span>
	);
}
