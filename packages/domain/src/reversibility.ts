/**
 * Reversibility — deciding whether an audited action can be undone and building
 * the compensating event that undoes it.
 *
 * The decision is a pure function of the event, the principal, and the current
 * state of the log (already-reverted? dependent changes?). The revert itself is
 * never an in-place mutation: {@link makeReversalEvent} produces a *new*
 * append-only event and leaves the original untouched.
 *
 * See architect auth-foundation report §reversibility.
 */

import type { AuditEvent } from "./audit.js";
import type { AuditEventId } from "./ids.js";
import type { ISODateString } from "./ids.js";
import type { SessionPrincipal } from "./auth-context.js";
import { hasPermission, isWorkspaceAdmin } from "./auth-context.js";

/** Whether an action can, in principle, be undone. */
export enum Reversibility {
	Reversible = "reversible",
	Irreversible = "irreversible",
}

/** Why a revert request was denied. */
export enum RevertDenyReason {
	NotFound = "not_found",
	NotReversible = "not_reversible",
	MissingInverse = "missing_inverse",
	NotAuthorized = "not_authorized",
	AlreadyReverted = "already_reverted",
	DependentChanges = "dependent_changes",
}

/** The concrete undo to apply, derived from an approved revert decision. */
export interface ReversalPlan {
	targetEventId: AuditEventId;
	/** Action name of the compensating event, e.g. "task.update.revert". */
	action: string;
	/** Payload to apply to undo the original change. */
	inverse: unknown;
}

/** Outcome of {@link canRevertAction}: a plan when allowed, a reason otherwise. */
export type RevertDecision =
	| { allowed: true; plan: ReversalPlan }
	| { allowed: false; reason: RevertDenyReason; message: string };

/** Everything {@link canRevertAction} needs to decide, with no I/O. */
export interface RevertContext {
	principal: SessionPrincipal;
	event: AuditEvent;
	/** Whether the event has already been reversed elsewhere in the log. */
	alreadyReverted?: boolean;
	/** Later events that depend on this one and would block a clean undo. */
	dependentEvents?: readonly AuditEvent[];
}

/**
 * Decide whether the principal may revert the event, and if so with what plan.
 *
 * Checks run in this order: not reversible → missing inverse → already reverted
 * → authorization → dependent changes → allowed. Authorization requires
 * `audit:revert` to undo one's own action, or workspace-admin plus
 * `audit:revert:any` to undo another user's.
 *
 * @param ctx The event, principal, and log state to decide over.
 */
export function canRevertAction(ctx: RevertContext): RevertDecision {
	const { event, principal } = ctx;

	if (event.reversibility === Reversibility.Irreversible) {
		const reason = event.irreversibleReason ?? "the action is marked irreversible";
		return {
			allowed: false,
			reason: RevertDenyReason.NotReversible,
			message: `Cannot revert: ${reason}`,
		};
	}

	if (event.inverse === undefined && event.before === undefined) {
		return {
			allowed: false,
			reason: RevertDenyReason.MissingInverse,
			message: "Cannot revert: no inverse or prior state is recorded for this event",
		};
	}

	if (ctx.alreadyReverted === true) {
		return {
			allowed: false,
			reason: RevertDenyReason.AlreadyReverted,
			message: "Cannot revert: this event has already been reverted",
		};
	}

	const isOwnAction = principal.userId !== undefined && event.actorUserId === principal.userId;
	const authorized = isOwnAction
		? hasPermission(principal, "audit:revert")
		: isWorkspaceAdmin(principal) && hasPermission(principal, "audit:revert:any");

	if (!authorized) {
		return {
			allowed: false,
			reason: RevertDenyReason.NotAuthorized,
			message: isOwnAction
				? "Cannot revert: missing the audit:revert permission"
				: "Cannot revert: reverting another user's action requires workspace admin and audit:revert:any",
		};
	}

	if (ctx.dependentEvents !== undefined && ctx.dependentEvents.length > 0) {
		return {
			allowed: false,
			reason: RevertDenyReason.DependentChanges,
			message: "Cannot revert: later changes depend on this event",
		};
	}

	return {
		allowed: true,
		plan: {
			targetEventId: event.id,
			action: `${event.action}.revert`,
			inverse: event.inverse ?? event.before,
		},
	};
}

/**
 * Build the compensating audit event that reverses `original`, without mutating
 * it. The new event swaps before/after, points back via `reversalOfEventId`,
 * inherits the original's scope, and is itself marked irreversible (reverting a
 * revert is out of scope).
 *
 * @param args Inputs for building the compensating event.
 * @param args.plan The approved reversal plan from {@link canRevertAction}.
 * @param args.principal The principal performing the revert.
 * @param args.original The event being reversed (read-only; never mutated).
 * @param args.id Id to assign to the new compensating event.
 * @param args.occurredAt Timestamp for the new event (caller-supplied).
 */
export function makeReversalEvent(args: {
	plan: ReversalPlan;
	principal: SessionPrincipal;
	original: AuditEvent;
	id: AuditEventId;
	occurredAt: ISODateString;
}): AuditEvent {
	const { plan, principal, original, id, occurredAt } = args;

	return {
		id,
		createdAt: occurredAt,
		updatedAt: occurredAt,
		occurredAt,
		actorUserId: principal.userId,
		source: principal.source,
		workspaceId: original.workspaceId,
		projectId: original.projectId,
		action: plan.action,
		targetType: original.targetType,
		targetId: original.targetId,
		before: original.after,
		after: original.before,
		reversibility: Reversibility.Irreversible,
		irreversibleReason: "reverting a revert is not supported",
		reversalOfEventId: original.id,
	};
}
