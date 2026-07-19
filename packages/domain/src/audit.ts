/**
 * Append-only audit log.
 *
 * Every state change records an immutable {@link AuditEvent}. Events are never
 * mutated or deleted; an undo is itself a new (compensating) event that points
 * back at the one it reverses. The before/after/inverse payloads are the basis
 * for reversibility (see `reversibility.ts`).
 *
 * See architect auth-foundation report §audit.
 */

import type { AuditEventId, Entity, ISODateString, ProjectId, UserId, WorkspaceId } from "./ids.js";
import type { Reversibility } from "./reversibility.js";

/** What kind of actor originated an action. */
export enum ActionSource {
	User = "user",
	Automation = "automation",
	Extension = "extension",
	System = "system",
}

/**
 * One immutable entry in the audit log. `before`/`after` capture the changed
 * state; `inverse` is an optional precomputed undo payload. Scope fields
 * (`workspaceId`, `projectId`) locate the event for authorization and querying.
 */
export interface AuditEvent extends Entity<AuditEventId> {
	/** Unset when the action was not performed by a user (system/automation). */
	actorUserId?: UserId;
	source: ActionSource;
	workspaceId?: WorkspaceId;
	projectId?: ProjectId;
	/** Domain action name, e.g. "task.update". */
	action: string;
	/** Type of the affected entity, e.g. "Task". */
	targetType: string;
	/** Id of the affected entity, as a string. */
	targetId: string;
	occurredAt: ISODateString;
	/** State before the change. */
	before?: unknown;
	/** State after the change. */
	after?: unknown;
	/** Precomputed undo payload, when the action provides one. */
	inverse?: unknown;
	reversibility: Reversibility;
	/** Human-readable reason the action cannot be reversed, when irreversible. */
	irreversibleReason?: string;
	/** Groups events produced by one logical operation. */
	correlationId?: string;
	/** Set on a compensating event: the id of the event it reverses. */
	reversalOfEventId?: AuditEventId;
}

/**
 * Whether an event has already been reversed, i.e. some other event in the log
 * has `reversalOfEventId` equal to `eventId`.
 *
 * @param events The audit log (or a relevant slice of it) to scan.
 * @param eventId The id of the event whose reversal state is in question.
 */
export function isReverted(events: readonly AuditEvent[], eventId: AuditEventId): boolean {
	return events.some((event) => event.reversalOfEventId === eventId);
}
