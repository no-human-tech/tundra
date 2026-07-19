import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Button variants:
 *  - `primary` — deep mint, the affirmative default action.
 *  - `accent`  — orange CTA (bold text, white-on-orange meets AA-large).
 *  - `brand`   — deep-mint pressed tone (kept for back-compat).
 *  - `secondary` — hairline outlined surface button.
 *  - `ghost`   — chrome-free.
 */
export type ButtonVariant = "primary" | "accent" | "brand" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	/** visual variant; defaults to `secondary` */
	variant?: ButtonVariant;
	/** control height; defaults to `md` */
	size?: ButtonSize;
	/** optional leading icon (decorative); rendered before the label */
	leadingIcon?: ReactNode;
	/** optional trailing icon (decorative); rendered after the label */
	trailingIcon?: ReactNode;
	children: ReactNode;
}

/**
 * Native <button> with token-driven variants. `primary` is deep mint; `accent`
 * is the restrained orange CTA reserved for the single most important action on a
 * surface.
 */
export function Button({
	variant = "secondary",
	size = "md",
	leadingIcon,
	trailingIcon,
	className,
	type,
	children,
	...rest
}: ButtonProps) {
	const classes = [
		"tnd-button",
		`tnd-button--${variant}`,
		size !== "md" ? `tnd-button--${size}` : "",
		className,
	]
		.filter(Boolean)
		.join(" ");
	return (
		<button type={type ?? "button"} className={classes} {...rest}>
			{leadingIcon}
			{children}
			{trailingIcon}
		</button>
	);
}
