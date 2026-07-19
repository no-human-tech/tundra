import { WorkItemStatus } from "@tundra/domain";

import { VisuallyHidden } from "./VisuallyHidden.js";

export interface StatusDotProps {
	status: WorkItemStatus;
	/** include a visually-hidden text label so status never relies on color alone */
	withLabel?: boolean;
	/** override the accessible status text (e.g. translated); defaults to statusLabel(status) */
	label?: string;
}

const STATUS_LABEL: Record<WorkItemStatus, string> = {
	[WorkItemStatus.Todo]: "To do",
	[WorkItemStatus.InProgress]: "In progress",
	[WorkItemStatus.Blocked]: "Blocked",
	[WorkItemStatus.Done]: "Done",
	[WorkItemStatus.Cancelled]: "Cancelled",
};

/**
 * A small status indicator whose shape AND color vary with status (square =
 * blocked, outline = to-do, filled = active/done). Always paired with an
 * accessible label so meaning is never color-only.
 */
export function StatusDot({ status, withLabel = true, label }: StatusDotProps) {
	const text = label ?? STATUS_LABEL[status];
	return (
		<>
			<span className={`tnd-statusdot tnd-statusdot--${status}`} aria-hidden="true" />
			{withLabel ? <VisuallyHidden>{text}</VisuallyHidden> : null}
		</>
	);
}

export function statusLabel(status: WorkItemStatus): string {
	return STATUS_LABEL[status];
}
