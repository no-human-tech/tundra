import type { SVGProps } from "react";

/**
 * The Tundra icon set — single-stroke, 24-grid, rounded-cap SVGs that inherit
 * `currentColor`. No icon font, no emoji. Paths are vendored from the comp's
 * icon engine (the design prototype's "ICON ENGINE", Lucide-ish).
 *
 * Each icon is `aria-hidden` by default (icons are decorative; pair them with a
 * visible/SR text label). Pass `title` to give an icon an accessible name when it
 * is the only content of an interactive control.
 */

/** A primitive path element of an icon: either a stroked path or a filled glyph. */
type Prim =
	| { t: "path"; d: string; fill?: true }
	| { t: "circle"; cx: number; cy: number; r: number; fill?: true }
	| { t: "rect"; x: number; y: number; w: number; h: number; rx: number; fill?: true };

/** Canonical icon name -> primitive geometry. */
const PATHS = {
	dashboard: [
		{ t: "rect", x: 3, y: 3, w: 7.5, h: 7.5, rx: 1.6 },
		{ t: "rect", x: 13.5, y: 3, w: 7.5, h: 7.5, rx: 1.6 },
		{ t: "rect", x: 3, y: 13.5, w: 7.5, h: 7.5, rx: 1.6 },
		{ t: "rect", x: 13.5, y: 13.5, w: 7.5, h: 7.5, rx: 1.6 },
	],
	projects: [
		{
			t: "path",
			d: "M4 7a2 2 0 0 1 2-2h3.2l2 2.2H19a2 2 0 0 1 2 2v7.8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z",
		},
	],
	tasks: [
		{ t: "rect", x: 3, y: 3, w: 18, h: 18, rx: 3.5 },
		{ t: "path", d: "m8.5 12.2 2.3 2.3 4.7-5" },
	],
	check: [{ t: "path", d: "m5 12.5 4.5 4.5 9.5-10.5" }],
	checkSquare: [
		{ t: "rect", x: 3, y: 3, w: 18, h: 18, rx: 3.5 },
		{ t: "path", d: "m8.5 12.2 2.3 2.3 4.7-5" },
	],
	time: [
		{ t: "circle", cx: 12, cy: 12, r: 8.6 },
		{ t: "path", d: "M12 7.2v5l3.3 1.9" },
	],
	clock: [
		{ t: "circle", cx: 12, cy: 12, r: 8.6 },
		{ t: "path", d: "M12 7.2v5l3.3 1.9" },
	],
	reports: [
		{ t: "path", d: "M3.5 20.5h17" },
		{ t: "path", d: "M7 20.5v-6" },
		{ t: "path", d: "M12 20.5v-11" },
		{ t: "path", d: "M17 20.5v-8" },
	],
	bars: [
		{ t: "path", d: "M3.5 20.5h17" },
		{ t: "path", d: "M7 20.5v-6" },
		{ t: "path", d: "M12 20.5v-11" },
		{ t: "path", d: "M17 20.5v-8" },
	],
	extensions: [
		{ t: "rect", x: 3.5, y: 3.5, w: 11, h: 11, rx: 2.2 },
		{ t: "rect", x: 9.5, y: 9.5, w: 11, h: 11, rx: 2.2 },
	],
	blocks: [
		{ t: "rect", x: 3.5, y: 3.5, w: 11, h: 11, rx: 2.2 },
		{ t: "rect", x: 9.5, y: 9.5, w: 11, h: 11, rx: 2.2 },
	],
	board: [
		{ t: "rect", x: 3.5, y: 4, w: 4.6, h: 16, rx: 1.4 },
		{ t: "rect", x: 9.7, y: 4, w: 4.6, h: 16, rx: 1.4 },
		{ t: "rect", x: 15.9, y: 4, w: 4.6, h: 16, rx: 1.4 },
	],
	columns: [
		{ t: "rect", x: 3.5, y: 4, w: 4.6, h: 16, rx: 1.4 },
		{ t: "rect", x: 9.7, y: 4, w: 4.6, h: 16, rx: 1.4 },
		{ t: "rect", x: 15.9, y: 4, w: 4.6, h: 16, rx: 1.4 },
	],
	backlog: [
		{ t: "path", d: "M8 6.5h12.5" },
		{ t: "path", d: "M8 12h12.5" },
		{ t: "path", d: "M8 17.5h12.5" },
		{ t: "path", d: "M3.6 6.5h.01" },
		{ t: "path", d: "M3.6 12h.01" },
		{ t: "path", d: "M3.6 17.5h.01" },
	],
	list: [
		{ t: "path", d: "M8 6.5h12.5" },
		{ t: "path", d: "M8 12h12.5" },
		{ t: "path", d: "M8 17.5h12.5" },
		{ t: "path", d: "M3.6 6.5h.01" },
		{ t: "path", d: "M3.6 12h.01" },
		{ t: "path", d: "M3.6 17.5h.01" },
	],
	sprints: [
		{ t: "path", d: "M20.5 12a8.5 8.5 0 1 1-2.6-6.1" },
		{ t: "path", d: "M20.5 4.2v3.8h-3.8" },
	],
	docs: [
		{ t: "path", d: "M13.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5z" },
		{ t: "path", d: "M13.5 3v5.5H19" },
		{ t: "path", d: "M9 13h6" },
		{ t: "path", d: "M9 16.5h6" },
	],
	comments: [
		{ t: "path", d: "M20.5 14.5a2 2 0 0 1-2 2H8l-4 3.5v-13a2 2 0 0 1 2-2h12.5a2 2 0 0 1 2 2z" },
	],
	message: [
		{ t: "path", d: "M20.5 14.5a2 2 0 0 1-2 2H8l-4 3.5v-13a2 2 0 0 1 2-2h12.5a2 2 0 0 1 2 2z" },
	],
	roadmap: [
		{ t: "path", d: "M9 4.5 3.5 6.7v13.3l5.5-2.2 6 2.2 5.5-2.2V4.5l-5.5 2.2-6-2.2z" },
		{ t: "path", d: "M9 4.5v13.3" },
		{ t: "path", d: "M15 6.7V20" },
	],
	automation: [{ t: "path", d: "M13 2.5 4 13.5h6.5l-1.5 8 9-11H11.5z" }],
	bolt: [{ t: "path", d: "M13 2.5 4 13.5h6.5l-1.5 8 9-11H11.5z" }],
	plug: [
		{ t: "path", d: "M12 21.5v-4" },
		{ t: "path", d: "M9.5 7.5v-5" },
		{ t: "path", d: "M14.5 7.5v-5" },
		{ t: "path", d: "M6.5 7.5h11v3.5a5.5 5.5 0 0 1-11 0z" },
	],
	search: [
		{ t: "circle", cx: 11, cy: 11, r: 7 },
		{ t: "path", d: "m20.5 20.5-4.2-4.2" },
	],
	bell: [
		{ t: "path", d: "M6 9a6 6 0 0 1 12 0c0 6.5 2.5 8 2.5 8h-17S6 15.5 6 9z" },
		{ t: "path", d: "M10.2 21a2 2 0 0 0 3.6 0" },
	],
	plus: [
		{ t: "path", d: "M12 5v14" },
		{ t: "path", d: "M5 12h14" },
	],
	add: [
		{ t: "path", d: "M12 5v14" },
		{ t: "path", d: "M5 12h14" },
	],
	chevronDown: [{ t: "path", d: "m6 9.5 6 6 6-6" }],
	chevronRight: [{ t: "path", d: "m9.5 6 6 6-6 6" }],
	arrowRight: [
		{ t: "path", d: "M4.5 12h15" },
		{ t: "path", d: "m13 5.5 6.5 6.5-6.5 6.5" },
	],
	close: [
		{ t: "path", d: "M18 6 6 18" },
		{ t: "path", d: "M6 6l12 12" },
	],
	link: [
		{ t: "path", d: "M9.5 17H8a5 5 0 0 1 0-10h1.5" },
		{ t: "path", d: "M14.5 7H16a5 5 0 0 1 0 10h-1.5" },
		{ t: "path", d: "M8.5 12h7" },
	],
	play: [{ t: "path", d: "M7 5.5v13l11-6.5z", fill: true }],
	pause: [
		{ t: "rect", x: 7, y: 5.5, w: 3.5, h: 13, rx: 1, fill: true },
		{ t: "rect", x: 13.5, y: 5.5, w: 3.5, h: 13, rx: 1, fill: true },
	],
	users: [
		{ t: "path", d: "M16 20v-1.6a4 4 0 0 0-4-4H6.5a4 4 0 0 0-4 4V20" },
		{ t: "circle", cx: 9.2, cy: 7.5, r: 3.7 },
		{ t: "path", d: "M21.5 20v-1.6a4 4 0 0 0-3-3.85" },
		{ t: "path", d: "M16.5 4.15a4 4 0 0 1 0 7.4" },
	],
	flag: [
		{ t: "path", d: "M5 21v-7" },
		{ t: "path", d: "M5 14s1-1 4-1 5 2 8 2 4-1 4-1V4s-1 1-4 1-5-2-8-2-4 1-4 1z" },
	],
	alert: [
		{
			t: "path",
			d: "M10.3 4 3.4 16.5A2 2 0 0 0 5.1 19.5h13.8a2 2 0 0 0 1.7-3L13.7 4a2 2 0 0 0-3.4 0z",
		},
		{ t: "path", d: "M12 9.5v4" },
		{ t: "path", d: "M12 17h.01" },
	],
	bug: [
		{ t: "rect", x: 8, y: 6, w: 8, h: 13, rx: 4 },
		{ t: "path", d: "M12 3.5v2.5" },
		{ t: "path", d: "M9 5 7.5 3.5" },
		{ t: "path", d: "M15 5l1.5-1.5" },
		{ t: "path", d: "M8 11H4" },
		{ t: "path", d: "M20 11h-4" },
		{ t: "path", d: "M8 16H4.5" },
		{ t: "path", d: "M19.5 16H16" },
	],
	star: [{ t: "path", d: "m12 3 2.5 5.5 6 .6-4.5 4 1.3 5.9L12 21l-5.3 1.5 1.3-5.9-4.5-4 6-.6z" }],
	terminal: [
		{ t: "path", d: "m5 16 5-4-5-4" },
		{ t: "path", d: "M12.5 17h6.5" },
	],
	github: [
		{
			t: "path",
			d: "M9 19c-4.3 1.4-4.3-2.2-6-2.6m12 4.6v-3.6c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.3 4.3 0 0 0-.1-3.2s-1.05-.3-3.5 1.3a12 12 0 0 0-6.2 0C6.05 3.05 5 3.35 5 3.35a4.3 4.3 0 0 0-.1 3.2A4.6 4.6 0 0 0 3.6 9.8c0 4.55 2.7 5.65 5.5 6-.4.4-.6.95-.5 1.5V21",
		},
	],
	more: [
		{ t: "circle", cx: 5, cy: 12, r: 1.3, fill: true },
		{ t: "circle", cx: 12, cy: 12, r: 1.3, fill: true },
		{ t: "circle", cx: 19, cy: 12, r: 1.3, fill: true },
	],
	settings: [
		{ t: "circle", cx: 12, cy: 12, r: 3.2 },
		{
			t: "path",
			d: "M19.4 14a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V20a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 4 14H4a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 4.6V4a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.6 1.6 0 0 0 20 10h.1a2 2 0 0 1 0 4z",
		},
	],
	cog: [
		{ t: "circle", cx: 12, cy: 12, r: 3.2 },
		{
			t: "path",
			d: "M19.4 14a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V20a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 4 14H4a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 4.6V4a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.6 1.6 0 0 0 20 10h.1a2 2 0 0 1 0 4z",
		},
	],
	mail: [
		{ t: "rect", x: 3, y: 5, w: 18, h: 14, rx: 2.5 },
		{ t: "path", d: "m4 7 8 6 8-6" },
	],
	review: [
		{ t: "path", d: "M2.5 12S5.5 5.5 12 5.5 21.5 12 21.5 12 18.5 18.5 12 18.5 2.5 12 2.5 12z" },
		{ t: "circle", cx: 12, cy: 12, r: 3 },
	],
	eye: [
		{ t: "path", d: "M2.5 12S5.5 5.5 12 5.5 21.5 12 21.5 12 18.5 18.5 12 18.5 2.5 12 2.5 12z" },
		{ t: "circle", cx: 12, cy: 12, r: 3 },
	],
	eyeOff: [
		{ t: "path", d: "M3 3l18 18" },
		{
			t: "path",
			d: "M10.6 5.6A10.6 10.6 0 0 1 12 5.5c6.5 0 9.5 6.5 9.5 6.5a15.4 15.4 0 0 1-3.3 4.3M6.7 6.7C4.2 8.3 2.5 12 2.5 12s3 6.5 9.5 6.5a9.7 9.7 0 0 0 3.3-.6",
		},
		{ t: "path", d: "M9.9 9.9a3 3 0 0 0 4.2 4.2" },
	],
	filter: [{ t: "path", d: "M3.5 5.5h17l-6.5 7.5V19l-4 2v-7.5z" }],
	sliders: [
		{ t: "path", d: "M4 7.5h16" },
		{ t: "path", d: "M4 12h16" },
		{ t: "path", d: "M4 16.5h16" },
		{ t: "circle", cx: 9, cy: 7.5, r: 2.2 },
		{ t: "circle", cx: 16, cy: 12, r: 2.2 },
		{ t: "circle", cx: 8, cy: 16.5, r: 2.2 },
	],
	sun: [
		{ t: "circle", cx: 12, cy: 12, r: 4.2 },
		{ t: "path", d: "M12 2.5v2.6" },
		{ t: "path", d: "M12 18.9v2.6" },
		{ t: "path", d: "M4.9 4.9l1.85 1.85" },
		{ t: "path", d: "M17.25 17.25 19.1 19.1" },
		{ t: "path", d: "M2.5 12h2.6" },
		{ t: "path", d: "M18.9 12h2.6" },
		{ t: "path", d: "m4.9 19.1 1.85-1.85" },
		{ t: "path", d: "M17.25 6.75 19.1 4.9" },
	],
	moon: [{ t: "path", d: "M12 3a6.364 6.364 0 0 0 9 9 9 9 0 1 1-9-9Z" }],
	lock: [
		{ t: "rect", x: 4.5, y: 10.5, w: 15, h: 10, rx: 2.4 },
		{ t: "path", d: "M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5" },
	],
	download: [
		{ t: "path", d: "M12 3.5v11.5" },
		{ t: "path", d: "m7 10.5 5 5 5-5" },
		{ t: "path", d: "M4.5 19.5h15" },
	],
	image: [
		{ t: "rect", x: 3, y: 4.5, w: 18, h: 15, rx: 2.5 },
		{ t: "circle", cx: 8.5, cy: 9.5, r: 1.6 },
		{ t: "path", d: "m4 17 5-5 3.5 3.5L17 11l3 3" },
	],
} satisfies Record<string, readonly Prim[]>;

/** All valid icon names. */
export type IconName = keyof typeof PATHS;

/** Sorted list of every available icon name (handy for the design-system page). */
export const ICON_NAMES = Object.keys(PATHS).sort() as IconName[];

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
	name: IconName;
	/** edge length in px (square). Default 19, matching the comp. */
	size?: number;
	/** stroke width for stroked icons. Default 1.85. */
	strokeWidth?: number;
	/**
	 * Accessible name. When provided the SVG becomes `role="img"` and is announced;
	 * otherwise it is `aria-hidden` (decorative, the default).
	 */
	title?: string;
}

/**
 * Render a named single-stroke icon. Decorative by default (aria-hidden); pass
 * `title` to expose an accessible name. Color is inherited via `currentColor`.
 */
export function Icon({ name, size = 19, strokeWidth = 1.85, title, ...rest }: IconProps) {
	const prims = PATHS[name] as readonly Prim[];
	const a11y = title ? { role: "img" as const, "aria-label": title } : { "aria-hidden": true };

	return (
		<svg
			className="tnd-icon"
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={strokeWidth}
			strokeLinecap="round"
			strokeLinejoin="round"
			{...a11y}
			{...rest}
		>
			{title ? <title>{title}</title> : null}
			{prims.map((p, i) => {
				if (p.t === "path") {
					return (
						<path key={i} d={p.d} {...(p.fill ? { fill: "currentColor", stroke: "none" } : null)} />
					);
				}
				if (p.t === "circle") {
					return (
						<circle
							key={i}
							cx={p.cx}
							cy={p.cy}
							r={p.r}
							{...(p.fill ? { fill: "currentColor", stroke: "none" } : null)}
						/>
					);
				}
				return (
					<rect
						key={i}
						x={p.x}
						y={p.y}
						width={p.w}
						height={p.h}
						rx={p.rx}
						{...(p.fill ? { fill: "currentColor", stroke: "none" } : null)}
					/>
				);
			})}
		</svg>
	);
}
