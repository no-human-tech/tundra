import type { HTMLAttributes, ReactNode } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
	/** apply default internal padding (skip when using CardHeader/CardSection) */
	padded?: boolean;
	/** hover lift + pointer affordance (use for clickable cards) */
	interactive?: boolean;
	/** dark deep-mint "ink" surface variant */
	tone?: "default" | "ink";
	children: ReactNode;
}

/**
 * A surface container: hairline border, rounded corners, quiet shadow on hover
 * when interactive. Compose with CardHeader / CardSection, or pass `padded` for
 * a simple single-region card.
 */
export function Card({
	padded = false,
	interactive = false,
	tone = "default",
	className,
	children,
	...rest
}: CardProps) {
	const classes = [
		"tnd-card",
		padded ? "tnd-card--padded" : "",
		interactive ? "tnd-card--interactive" : "",
		tone === "ink" ? "tnd-card--ink" : "",
		className,
	]
		.filter(Boolean)
		.join(" ");
	return (
		<div className={classes} {...rest}>
			{children}
		</div>
	);
}

export interface CardHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
	title?: ReactNode;
	/** trailing controls (buttons, menus) aligned to the end */
	actions?: ReactNode;
	/** leading element (icon, avatar) before the title */
	leading?: ReactNode;
	children?: ReactNode;
}

/** Card header row: optional leading, a title, and end-aligned actions. */
export function CardHeader({
	title,
	actions,
	leading,
	className,
	children,
	...rest
}: CardHeaderProps) {
	const classes = ["tnd-card__header", className].filter(Boolean).join(" ");
	return (
		<div className={classes} {...rest}>
			{leading}
			{title ? <div className="tnd-card__title">{title}</div> : null}
			{children}
			{actions ? <div className="tnd-card__header-actions">{actions}</div> : null}
		</div>
	);
}

export interface CardSectionProps extends HTMLAttributes<HTMLDivElement> {
	children: ReactNode;
}

/** A padded body region; stacked sections are separated by a hairline rule. */
export function CardSection({ className, children, ...rest }: CardSectionProps) {
	const classes = ["tnd-card__section", className].filter(Boolean).join(" ");
	return (
		<div className={classes} {...rest}>
			{children}
		</div>
	);
}
