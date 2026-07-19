import type { ReactNode } from "react";

export type ChipTone =
	"neutral" | "success" | "warning" | "danger" | "info" | "ext" | "accent" | "brand";

export interface ChipProps {
	tone?: ChipTone;
	children: ReactNode;
}

/**
 * Small rounded label for metadata (priority, counts, tags). Tone maps to a
 * token pair tuned for AA contrast. The text content always carries the meaning;
 * tone is supplementary, never the sole signal.
 */
export function Chip({ tone = "neutral", children }: ChipProps) {
	const toneClass = tone === "neutral" ? "" : `tnd-chip--${tone}`;
	const classes = ["tnd-chip", toneClass].filter(Boolean).join(" ");
	return <span className={classes}>{children}</span>;
}
