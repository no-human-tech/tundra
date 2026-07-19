import { useEffect, useState } from "react";

/**
 * Ticks an elapsed-seconds counter forward once per second while `running` is
 * true, starting from `initialSeconds`. Backs the live Timer display
 * (the design spec §7.10) so "Tracking" is an actually-live state rather
 * than a frozen fixture value — pausing (running=false) stops the count
 * without resetting it.
 */
export function useLiveTimer(initialSeconds: number, running: boolean): number {
	const [elapsed, setElapsed] = useState(initialSeconds);

	useEffect(() => {
		if (!running) return undefined;
		const id = window.setInterval(() => {
			setElapsed((seconds) => seconds + 1);
		}, 1000);
		return () => window.clearInterval(id);
	}, [running]);

	return elapsed;
}
