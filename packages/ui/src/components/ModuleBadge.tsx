import { WorkItemSource } from "@tundra/domain";

import { Icon, type IconName } from "../primitives/Icon.js";

/**
 * Source-as-metadata mapping — the single source of truth for how each
 * WorkItemSource is labeled and decorated. Every WorkItem renders with the SAME
 * row component; ONLY this badge changes per source. Color + icon are redundant
 * to the always-present text label, so meaning never relies on color alone.
 *
 * Token families per source (from the design-system spec):
 *   task -> mint/brand · story_checklist -> mint soft · subtask -> neutral ·
 *   bug -> danger · review -> info · docs -> warning ·
 *   automation/extension -> ext (purple). Colors live in the
 *   `.tnd-modulebadge[data-source="…"]` rules in components.css.
 */
export interface SourceBadgeMeta {
	/** default human label (overridden by a module label for extension sources) */
	label: string;
	/** name of the single-stroke icon rendered alongside the label (decorative) */
	icon: IconName;
}

export const SOURCE_BADGE_MAP: Record<WorkItemSource, SourceBadgeMeta> = {
	[WorkItemSource.Task]: { label: "Task", icon: "checkSquare" },
	[WorkItemSource.StoryChecklist]: { label: "Story item", icon: "check" },
	[WorkItemSource.Subtask]: { label: "Subtask", icon: "list" },
	[WorkItemSource.Bug]: { label: "Bug", icon: "bug" },
	[WorkItemSource.Review]: { label: "Review", icon: "review" },
	[WorkItemSource.Docs]: { label: "Docs", icon: "docs" },
	[WorkItemSource.Automation]: { label: "Automation", icon: "bolt" },
	[WorkItemSource.Extension]: { label: "Extension", icon: "plug" },
};

export interface ModuleBadgeProps {
	source: WorkItemSource;
	/** shown instead of the default label for extension/automation sources */
	moduleLabel?: string;
	size?: "sm" | "md";
	/**
	 * Overrides the computed visible label (e.g. translated). When omitted the
	 * label is the existing behavior: `moduleLabel` for extension/automation
	 * sources, otherwise `SOURCE_BADGE_MAP[source].label`. The `data-source`
	 * attribute and the color/icon mapping are unaffected (source-as-metadata).
	 */
	label?: string;
	/**
	 * Overrides the hover/title text on the badge (e.g. translated). Defaults to
	 * `Source: ${SOURCE_BADGE_MAP[source].label}`.
	 */
	sourceTitle?: string;
}

/**
 * Renders a source/origin badge. For extension/automation sources, the visible
 * label is the contributing module's name when provided. Output is a single
 * <span> with `data-source` for centralized styling and a visible text label.
 *
 * All user-visible text (the label and the hover title) is overridable for i18n;
 * the `data-source` attribute and the per-source color/icon mapping never change,
 * so source-as-metadata and the centralized styling are preserved.
 */
export function ModuleBadge({
	source,
	moduleLabel,
	size = "md",
	label,
	sourceTitle,
}: ModuleBadgeProps) {
	const meta = SOURCE_BADGE_MAP[source];
	const usesModuleLabel =
		(source === WorkItemSource.Extension || source === WorkItemSource.Automation) &&
		Boolean(moduleLabel);
	const resolvedLabel = label ?? (usesModuleLabel ? (moduleLabel as string) : meta.label);
	const classes = ["tnd-modulebadge", size === "sm" ? "tnd-modulebadge--sm" : ""]
		.filter(Boolean)
		.join(" ");

	return (
		<span className={classes} data-source={source} title={sourceTitle ?? `Source: ${meta.label}`}>
			<span className="tnd-modulebadge__icon" aria-hidden="true">
				<Icon name={meta.icon} size={size === "sm" ? 12 : 14} />
			</span>
			<span className="tnd-modulebadge__label">{resolvedLabel}</span>
		</span>
	);
}
