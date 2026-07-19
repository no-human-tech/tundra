import type { ReactNode } from "react";

export type MetricStatTone = "default" | "brand" | "accent" | "danger";

export interface MetricStatProps {
	value: ReactNode;
	label: ReactNode;
	tone?: MetricStatTone;
	/** render without the bordered chip wrapper (inline number + label) */
	plain?: boolean;
}

/**
 * A compact metric: a large display value with a small label. Used in dashboard
 * header strips and the My Tasks metrics row (assigned · due today · blocked …).
 */
export function MetricStat({ value, label, tone = "default", plain = false }: MetricStatProps) {
	const classes = [
		"tnd-metricstat",
		tone !== "default" ? `tnd-metricstat--${tone}` : "",
		plain ? "tnd-metricstat--plain" : "",
	]
		.filter(Boolean)
		.join(" ");
	return (
		<div className={classes}>
			<span className="tnd-metricstat__value">{value}</span>
			<span className="tnd-metricstat__label">{label}</span>
		</div>
	);
}
