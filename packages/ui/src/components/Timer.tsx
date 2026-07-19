import type { ReactNode } from "react";

import { Icon } from "../primitives/Icon.js";

export interface TimerProps {
	/** whether the timer is currently running */
	running: boolean;
	/** the formatted elapsed time, e.g. "01:15:21" (caller formats it) */
	display: ReactNode;
	/** start/stop handler */
	onToggle?: () => void;
	/** small state line above/below the context (e.g. "Tracking time") */
	state?: ReactNode;
	/** what is being tracked (e.g. "AUR-119 · Drawer slot extension point") */
	context?: ReactNode;
	/** accessible label for the start/stop button; when set it wins over start/stopLabel */
	toggleLabel?: string;
	/** accessible label when the timer is stopped (e.g. translated); defaults to "Start timer" */
	startLabel?: string;
	/** accessible label when the timer is running (e.g. translated); defaults to "Stop timer" */
	stopLabel?: string;
}

/**
 * A start/stop timer display. The play/pause button pulses orange while running
 * (the brand's "live" accent) and the elapsed time uses tabular mono numerals.
 * State is also stated as text, so "running" is never conveyed by color alone.
 */
export function Timer({
	running,
	display,
	onToggle,
	state,
	context,
	toggleLabel,
	startLabel = "Start timer",
	stopLabel = "Stop timer",
}: TimerProps) {
	const label = toggleLabel ?? (running ? stopLabel : startLabel);
	return (
		<div className="tnd-timer">
			<button
				type="button"
				className="tnd-timer__button"
				data-running={running ? "true" : "false"}
				aria-pressed={running}
				aria-label={label}
				onClick={onToggle}
			>
				<Icon name={running ? "pause" : "play"} size={22} />
			</button>
			<div className="tnd-timer__body">
				{state ? <span className="tnd-timer__state">{state}</span> : null}
				{context ? <span className="tnd-timer__state">{context}</span> : null}
				<span className="tnd-timer__display" data-running={running ? "true" : "false"}>
					{display}
				</span>
			</div>
		</div>
	);
}
