import type { ReactNode } from "react";

import { Badge, type BadgeTone } from "../primitives/Badge.js";
import { Toggle } from "../primitives/Toggle.js";

/** Lifecycle status of a module in the marketplace / settings. */
export type ModuleStatus = "Installed" | "Enabled" | "Disabled" | "Experimental";

export interface ModuleCardProps {
	name: string;
	/** category + version line, e.g. "Workflow · v2.4.0" */
	meta?: ReactNode;
	description?: ReactNode;
	status: ModuleStatus;
	/** module icon (e.g. <Icon name="columns" />) shown in the tinted tile */
	icon?: ReactNode;
	/** when provided, a toggle is shown reflecting enabled state */
	enabled?: boolean;
	onToggle?: (next: boolean) => void;
	/** disable the toggle (e.g. a required Core module) */
	toggleDisabled?: boolean;
	/** optional footer actions (e.g. Configure / Preview buttons) */
	actions?: ReactNode;
	/** visible status-badge text (e.g. translated); defaults to the `status` value */
	statusLabel?: ReactNode;
	/** accessible toggle name when enabled (the "turn off" action); defaults to `Disable ${name}` */
	disableLabel?: string;
	/** accessible toggle name when disabled (the "turn on" action); defaults to `Enable ${name}` */
	enableLabel?: string;
}

const STATUS_TONE: Record<ModuleStatus, BadgeTone> = {
	Installed: "neutral",
	Enabled: "success",
	Disabled: "neutral",
	Experimental: "ext",
};

const STATUS_ICON_KEY: Record<ModuleStatus, string> = {
	Installed: "installed",
	Enabled: "enabled",
	Disabled: "disabled",
	Experimental: "experimental",
};

/**
 * A marketplace/settings card for one module: tinted icon tile, name + meta, a
 * status badge (Installed / Enabled / Disabled / Experimental), description, and
 * an optional enable toggle plus footer actions. Presentational only.
 */
export function ModuleCard({
	name,
	meta,
	description,
	status,
	icon,
	enabled,
	onToggle,
	toggleDisabled = false,
	actions,
	statusLabel,
	disableLabel,
	enableLabel,
}: ModuleCardProps) {
	const showToggle = typeof enabled === "boolean";
	const toggleName = enabled
		? (disableLabel ?? `Disable ${name}`)
		: (enableLabel ?? `Enable ${name}`);
	return (
		<div className="tnd-modulecard">
			<div className="tnd-modulecard__head">
				{icon ? (
					<span
						className="tnd-modulecard__icon"
						data-status={STATUS_ICON_KEY[status]}
						aria-hidden="true"
					>
						{icon}
					</span>
				) : null}
				<div className="tnd-modulecard__meta">
					<div className="tnd-modulecard__name">{name}</div>
					{meta ? <div className="tnd-modulecard__sub">{meta}</div> : null}
				</div>
				<Badge tone={STATUS_TONE[status]}>{statusLabel ?? status}</Badge>
			</div>

			{description ? <p className="tnd-modulecard__desc">{description}</p> : null}

			{showToggle || actions ? (
				<div className="tnd-modulecard__footer">
					{actions}
					{showToggle ? (
						<Toggle
							checked={Boolean(enabled)}
							disabled={toggleDisabled}
							label={toggleName}
							onChange={onToggle}
						/>
					) : null}
				</div>
			) : null}
		</div>
	);
}
