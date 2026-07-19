import type { ButtonHTMLAttributes, ReactNode } from "react";

export type IconButtonVariant = "default" | "ghost";
export type IconButtonSize = "sm" | "md";

export interface IconButtonProps extends Omit<
	ButtonHTMLAttributes<HTMLButtonElement>,
	"aria-label"
> {
	/** REQUIRED accessible name — an icon-only control must be labeled */
	label: string;
	/** the icon to render (e.g. <Icon name="bell" />) */
	children: ReactNode;
	variant?: IconButtonVariant;
	size?: IconButtonSize;
	/** show the orange notification dot (e.g. unread notifications) */
	hasDot?: boolean;
}

/**
 * A square, icon-only button. Always carries an accessible name via `label`
 * (rendered as aria-label) so the control is never unlabeled. Optionally shows
 * the brand's orange notification dot.
 */
export function IconButton({
	label,
	children,
	variant = "default",
	size = "md",
	hasDot = false,
	className,
	type,
	...rest
}: IconButtonProps) {
	const classes = [
		"tnd-iconbutton",
		variant !== "default" ? `tnd-iconbutton--${variant}` : "",
		size !== "md" ? `tnd-iconbutton--${size}` : "",
		className,
	]
		.filter(Boolean)
		.join(" ");
	return (
		<button type={type ?? "button"} className={classes} aria-label={label} {...rest}>
			{children}
			{hasDot ? <span className="tnd-iconbutton__dot" aria-hidden="true" /> : null}
		</button>
	);
}
