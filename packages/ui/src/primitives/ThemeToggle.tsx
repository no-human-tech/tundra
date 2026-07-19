import { useThemeSync } from "../theme/useThemeSync.js";
import { Icon } from "./Icon.js";
import { IconButton, type IconButtonSize } from "./IconButton.js";

export interface ThemeToggleProps {
	/** Accessible name shown/announced when the theme is currently light (offers switching to dark). */
	labelSwitchToDark: string;
	/** Accessible name shown/announced when the theme is currently dark (offers switching to light). */
	labelSwitchToLight: string;
	size?: IconButtonSize;
	className?: string;
}

/**
 * Sun/moon theme toggle — the design spec §2.5. 38x38 at `size="md"`
 * (`IconButton`'s default), used in the app topbar and the auth header. Presentational only: labels are supplied by the caller so
 * this package stays free of an i18n dependency.
 */
export function ThemeToggle({
	labelSwitchToDark,
	labelSwitchToLight,
	size,
	className,
}: ThemeToggleProps) {
	const [theme, toggle] = useThemeSync();
	const isDark = theme === "dark";
	const classes = ["tnd-iconbutton--theme", className].filter(Boolean).join(" ");

	return (
		<IconButton
			label={isDark ? labelSwitchToLight : labelSwitchToDark}
			onClick={toggle}
			size={size}
			className={classes}
		>
			<Icon name={isDark ? "sun" : "moon"} size={18} />
		</IconButton>
	);
}
