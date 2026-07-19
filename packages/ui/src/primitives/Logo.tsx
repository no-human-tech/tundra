import type { SVGProps } from "react";

/**
 * The Tundra logo mark — "Horizon Stack": stacked modular bands reading as a
 * tundra horizon with an orange aurora streak (the modularity metaphor). Scales
 * from a 16px favicon to a 48px org avatar. Vendored from the comp's `mark()`.
 *
 * Decorative by default (aria-hidden); pass `title` for an accessible name (e.g.
 * when used as the sole content of a home link without nearby text).
 */
export interface LogoProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
	/** edge length in px (square). Default 28. */
	size?: number;
	/** accessible name; when set the mark is announced as an image */
	title?: string;
}

export function Logo({ size = 28, title, ...rest }: LogoProps) {
	const r = size * 0.27;
	const a11y = title ? { role: "img" as const, "aria-label": title } : { "aria-hidden": true };
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 32 32"
			style={{ display: "block", flex: "none" }}
			{...a11y}
			{...rest}
		>
			{title ? <title>{title}</title> : null}
			<rect x={0} y={0} width={32} height={32} rx={r} fill="var(--tnd-color-mint-500, #0f766e)" />
			<rect
				x={7}
				y={7.5}
				width={9.5}
				height={3.4}
				rx={1.7}
				fill="var(--tnd-color-orange-400, #ff8a3d)"
			/>
			<rect
				x={7}
				y={13.3}
				width={18}
				height={3.4}
				rx={1.7}
				fill="var(--tnd-color-mint-300, #7ceac4)"
			/>
			<rect
				x={7}
				y={19.1}
				width={13.5}
				height={3.4}
				rx={1.7}
				fill="var(--tnd-color-mint-200, #cff4e6)"
			/>
		</svg>
	);
}
