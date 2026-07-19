import type { CSSProperties } from "react";

export type SkeletonVariant = "block" | "text" | "circle";

export interface SkeletonProps {
	variant?: SkeletonVariant;
	width?: number | string;
	height?: number | string;
	/** override the corner radius (CSS length) */
	radius?: number | string;
	className?: string;
	style?: CSSProperties;
}

/**
 * A shimmering placeholder for loading content. Respects prefers-reduced-motion
 * (the shimmer animation is neutralized by the global reduced-motion guard). It
 * is decorative (aria-hidden); announce loading state at the region level (e.g.
 * aria-busy on the container) rather than per skeleton.
 */
export function Skeleton({
	variant = "block",
	width,
	height,
	radius,
	className,
	style,
}: SkeletonProps) {
	const classes = ["tnd-skeleton", variant !== "block" ? `tnd-skeleton--${variant}` : "", className]
		.filter(Boolean)
		.join(" ");
	return (
		<span
			className={classes}
			aria-hidden="true"
			style={{ width, height, borderRadius: radius, ...style }}
		/>
	);
}
