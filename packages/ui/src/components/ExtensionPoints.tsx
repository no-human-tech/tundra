import type { ReactNode } from "react";

/** One named extension slot in the registry. */
export interface ExtensionSlotInfo {
	id: string;
	/** display name, e.g. "Task drawer" */
	name: string;
	/** the manifest slot id, e.g. "task.drawer" */
	slotId?: string;
	description?: ReactNode;
	/** number of modules currently contributing */
	contributing?: number;
	/** decorative slot icon */
	icon?: ReactNode;
}

export interface ExtensionSlotProps {
	slot: ExtensionSlotInfo;
	/** formats the "{n} contributing" count line (e.g. translated); receives the count */
	contributingLabel?: (count: number) => ReactNode;
}

/**
 * A single extension-point slot tile (used inside ExtensionPointsRegistry). Shows
 * the slot name, contributing count, and a short description. The little bars are
 * a decorative "how full is this slot" hint.
 */
export function ExtensionSlot({ slot, contributingLabel }: ExtensionSlotProps) {
	return (
		<li className="tnd-extslot">
			<div className="tnd-extslot__head">
				{slot.icon ? (
					<span className="tnd-extslot__icon" aria-hidden="true">
						{slot.icon}
					</span>
				) : null}
				<div>
					<div className="tnd-extslot__name">{slot.name}</div>
					{typeof slot.contributing === "number" ? (
						<div className="tnd-extslot__count">
							{contributingLabel
								? contributingLabel(slot.contributing)
								: `${slot.contributing} contributing`}
						</div>
					) : slot.slotId ? (
						<div className="tnd-extslot__count">{slot.slotId}</div>
					) : null}
				</div>
			</div>
			{slot.description ? <p className="tnd-extslot__desc">{slot.description}</p> : null}
		</li>
	);
}

export interface ExtensionPointsRegistryProps {
	/** the named slots (typically the 6: Sidebar, Project tabs, Task drawer, Dashboard widgets, Automation actions, Reports) */
	slots: ExtensionSlotInfo[];
	/** dark panel heading */
	title?: ReactNode;
	/** mono kicker above the title */
	kicker?: ReactNode;
	/** intro paragraph */
	description?: ReactNode;
	/** end-of-header note, e.g. "6 named slots" */
	countLabel?: ReactNode;
	/** accessible name for the <section> landmark (e.g. translated); defaults to "Extension points" */
	ariaLabel?: string;
	/** forwarded to each slot to translate the "{n} contributing" count line */
	contributingLabel?: (count: number) => ReactNode;
}

/**
 * The Extension Points registry — a dark deep-mint panel listing the named slots
 * modules can plug into. Makes modularity visible as a first-class concept rather
 * than hiding it in settings. Presentational; data-driven via `slots`.
 */
export function ExtensionPointsRegistry({
	slots,
	title = "Every module has a clear place to plug in.",
	kicker = "Extension points",
	description = "Modules don't patch the UI — they register against named slots. Add a module and it appears exactly where it declared, no redesign required.",
	countLabel,
	ariaLabel = "Extension points",
	contributingLabel,
}: ExtensionPointsRegistryProps) {
	return (
		<section className="tnd-extregistry" aria-label={ariaLabel}>
			<div className="tnd-extregistry__head">
				<div>
					{kicker ? <div className="tnd-extregistry__kicker">{kicker}</div> : null}
					<h2 className="tnd-extregistry__title">{title}</h2>
				</div>
				{countLabel ? <span className="tnd-extregistry__count">{countLabel}</span> : null}
			</div>
			{description ? <p className="tnd-extregistry__lead">{description}</p> : null}
			<ul className="tnd-extregistry__grid">
				{slots.map((slot) => (
					<ExtensionSlot key={slot.id} slot={slot} contributingLabel={contributingLabel} />
				))}
			</ul>
		</section>
	);
}
