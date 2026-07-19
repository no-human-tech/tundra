import type { ReactNode } from "react";

import { Icon, MetricStat, type IconName, type MetricStatTone } from "@tundra/ui";

export interface SectionProps {
	title: ReactNode;
	hint?: ReactNode;
	/** end-aligned controls on the section header row */
	actions?: ReactNode;
	children: ReactNode;
}

/** A labelled content section with a header row (title + hint + actions). */
export function Section({ title, hint, actions, children }: SectionProps) {
	return (
		<section className="tnd-section">
			<div className="tnd-section__head">
				<h2 className="tnd-section__title">{title}</h2>
				{hint ? <span className="tnd-section__hint">{hint}</span> : null}
				{actions ? <span style={{ marginLeft: "auto" }}>{actions}</span> : null}
			</div>
			{children}
		</section>
	);
}

export interface MetricCardProps {
	label: string;
	value: ReactNode;
	delta?: ReactNode;
	deltaAccent?: boolean;
	sub?: ReactNode;
	icon: IconName;
	/**
	 * 0–100: when set, renders a small SVG progress ring around the icon instead
	 * of the plain tinted square (the design spec §7.5 — "My open tasks" as a
	 * donut, "Sprint health" as a ring).
	 */
	ring?: number;
	/** ring stroke color; defaults to the brand mint. */
	ringTone?: "brand" | "accent";
}

/** A dashboard metric card: large value, label, delta, sub-line, tinted icon (or
 * an SVG progress ring when `ring` is provided). */
export function MetricCard({
	label,
	value,
	delta,
	deltaAccent,
	sub,
	icon,
	ring,
	ringTone,
}: MetricCardProps) {
	return (
		<div className="tnd-card tnd-card--padded tnd-metriccard">
			<div className="tnd-metriccard__top">
				<span className="tnd-metriccard__label">{label}</span>
				{ring === undefined ? (
					<span className="tnd-metriccard__icon" aria-hidden="true">
						<Icon name={icon} size={18} />
					</span>
				) : (
					<MetricRing percent={ring} tone={ringTone ?? "brand"} icon={icon} />
				)}
			</div>
			<span className="tnd-metriccard__value">{value}</span>
			<div className="tnd-row">
				{delta ? (
					<span
						className={["tnd-delta", deltaAccent ? "tnd-delta--accent" : ""]
							.filter(Boolean)
							.join(" ")}
					>
						{delta}
					</span>
				) : null}
				{sub ? <span className="tnd-metriccard__sub">{sub}</span> : null}
			</div>
		</div>
	);
}

/** A small SVG donut/ring progress indicator (plain `stroke-dasharray`, no
 * charting library) with the metric's icon centered inside. Used by MetricCard
 * when `ring` is provided. */
function MetricRing({
	percent,
	tone,
	icon,
}: {
	percent: number;
	tone: "brand" | "accent";
	icon: IconName;
}) {
	const size = 36;
	const stroke = 3;
	const radius = (size - stroke) / 2;
	const circumference = 2 * Math.PI * radius;
	const clamped = Math.max(0, Math.min(100, percent));
	const offset = circumference - (clamped / 100) * circumference;
	const color = tone === "accent" ? "var(--tnd-color-accent)" : "var(--tnd-color-brand)";
	return (
		<span
			style={{
				position: "relative",
				width: size,
				height: size,
				display: "inline-flex",
				alignItems: "center",
				justifyContent: "center",
				flex: "none",
			}}
		>
			<svg
				width={size}
				height={size}
				viewBox={`0 0 ${size} ${size}`}
				aria-hidden="true"
				style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}
			>
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					stroke="var(--tnd-color-border)"
					strokeWidth={stroke}
				/>
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					stroke={color}
					strokeWidth={stroke}
					strokeDasharray={circumference}
					strokeDashoffset={offset}
					strokeLinecap="round"
				/>
			</svg>
			<Icon name={icon} size={14} aria-hidden style={{ color }} />
		</span>
	);
}

export interface DonutSegment {
	label: string;
	count: number;
	color: string;
}

export interface DonutChartProps {
	segments: DonutSegment[];
	/** overall size in px (both width and height); default 120 to match the
	 * dashboard "My open tasks" widget. */
	size?: number;
	/** ring stroke thickness in px */
	thickness?: number;
	/** big number centered inside the ring */
	centerValue: ReactNode;
	/** small caption under the center value */
	centerLabel: ReactNode;
	/** accessible name summarizing the chart, e.g. "12 tasks total" */
	ariaLabel: string;
}

/** A small multi-segment SVG donut chart (plain `stroke-dasharray`, no charting
 * library) with a value + label centered inside. Segments are stacked in the
 * order given; a zero-total chart renders an empty ring rather than dividing
 * by zero. */
export function DonutChart({
	segments,
	size = 120,
	thickness = 14,
	centerValue,
	centerLabel,
	ariaLabel,
}: DonutChartProps) {
	const total = segments.reduce((sum, s) => sum + s.count, 0);
	const radius = (size - thickness) / 2;
	const circumference = 2 * Math.PI * radius;
	let drawn = 0;
	return (
		<span
			role="img"
			aria-label={ariaLabel}
			style={{
				position: "relative",
				width: size,
				height: size,
				display: "inline-flex",
				flex: "none",
			}}
		>
			<svg
				width={size}
				height={size}
				viewBox={`0 0 ${size} ${size}`}
				aria-hidden="true"
				style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}
			>
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					stroke="var(--tnd-color-border)"
					strokeWidth={thickness}
				/>
				{total > 0
					? segments
							.filter((s) => s.count > 0)
							.map((s, i) => {
								const dash = (s.count / total) * circumference;
								const el = (
									<circle
										key={i}
										cx={size / 2}
										cy={size / 2}
										r={radius}
										fill="none"
										stroke={s.color}
										strokeWidth={thickness}
										strokeDasharray={`${dash} ${circumference - dash}`}
										strokeDashoffset={-drawn}
									/>
								);
								drawn += dash;
								return el;
							})
					: null}
			</svg>
			<span
				style={{
					position: "absolute",
					inset: 0,
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				<span
					style={{
						fontSize: "1.625rem",
						fontWeight: 800,
						color: "var(--tnd-color-text)",
						lineHeight: 1,
					}}
				>
					{centerValue}
				</span>
				<span style={{ fontSize: "0.625rem", color: "var(--tnd-color-text-subtle)" }}>
					{centerLabel}
				</span>
			</span>
		</span>
	);
}

export interface WeekBarValue {
	/** short weekday label, e.g. "Mon" */
	day: string;
	value: number;
}

export interface WeekBarChartProps {
	values: WeekBarValue[];
	/** accessible name summarizing the chart, e.g. "Hours logged this week" */
	ariaLabel: string;
	color?: string;
}

/** A small 7-column bar chart (plain divs, no charting library) with a weekday
 * label under each bar. Bar heights are relative to the largest value in the
 * set; an all-zero week renders flat (near-zero-height) bars. */
export function WeekBarChart({ values, ariaLabel, color }: WeekBarChartProps) {
	const max = Math.max(1, ...values.map((v) => v.value));
	return (
		<div className="tnd-weekbars" role="img" aria-label={ariaLabel}>
			{values.map((v, i) => (
				<div className="tnd-weekbars__col" key={i} aria-hidden="true">
					<div
						className="tnd-weekbars__bar"
						style={{
							height: `${Math.max(2, Math.round((v.value / max) * 100))}%`,
							background: color,
						}}
					/>
					<span className="tnd-weekbars__label">{v.day}</span>
				</div>
			))}
		</div>
	);
}

export interface FilterChipProps {
	label: string;
	value: string;
	pinned?: boolean;
}

/** A non-functional demo filter affordance (label · value · chevron). */
export function FilterChip({ label, value, pinned }: FilterChipProps) {
	return (
		<button
			type="button"
			className={["tnd-filter", pinned ? "tnd-filter--pinned" : ""].filter(Boolean).join(" ")}
		>
			<span className="tnd-filter__label">{label}</span>
			<span className="tnd-filter__value">{value}</span>
			<Icon name="chevronDown" size={14} aria-hidden />
		</button>
	);
}

/** A small inline metric (value + label) for header strips. */
export function InlineMetric({
	value,
	label,
	tone,
}: {
	value: ReactNode;
	label: ReactNode;
	tone?: MetricStatTone;
}) {
	return <MetricStat value={value} label={label} tone={tone} plain />;
}
