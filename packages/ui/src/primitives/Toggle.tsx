import type { ButtonHTMLAttributes } from "react";

export interface ToggleProps extends Omit<
	ButtonHTMLAttributes<HTMLButtonElement>,
	"onChange" | "aria-label"
> {
	/** controlled on/off state */
	checked: boolean;
	/** REQUIRED accessible name describing what is toggled */
	label: string;
	/** called with the next checked value when activated */
	onChange?: (next: boolean) => void;
}

/**
 * An accessible switch built on a native <button role="switch">. Keyboard
 * operable (Enter/Space) and announced with its on/off state via aria-checked.
 * The label is required so the control is never unlabeled.
 */
export function Toggle({ checked, label, onChange, disabled, className, ...rest }: ToggleProps) {
	const classes = ["tnd-toggle", className].filter(Boolean).join(" ");
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			aria-label={label}
			disabled={disabled}
			className={classes}
			onClick={onChange ? () => onChange(!checked) : undefined}
			{...rest}
		/>
	);
}
