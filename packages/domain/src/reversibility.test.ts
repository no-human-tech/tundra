import { describe, expect, it } from "vitest";

import { ActionSource, isReverted } from "./audit.js";
import type { AuditEvent } from "./audit.js";
import {
	Reversibility,
	RevertDenyReason,
	canRevertAction,
	makeReversalEvent,
} from "./reversibility.js";
import type { SessionPrincipal } from "./auth-context.js";
import type { AuditEventId, UserId, WorkspaceId } from "./ids.js";

const ada = "user-ada" as UserId;
const bob = "user-bob" as UserId;
const ws = "ws-1" as WorkspaceId;
const eventId = "evt-1" as AuditEventId;
const reversalId = "evt-2" as AuditEventId;
const now = "2026-06-27T12:00:00.000Z";

function event(overrides: Partial<AuditEvent> = {}): AuditEvent {
	return {
		id: eventId,
		createdAt: "2026-06-01T00:00:00.000Z",
		updatedAt: "2026-06-01T00:00:00.000Z",
		occurredAt: "2026-06-01T00:00:00.000Z",
		actorUserId: ada,
		source: ActionSource.User,
		workspaceId: ws,
		action: "task.update",
		targetType: "Task",
		targetId: "task-1",
		before: { title: "old" },
		after: { title: "new" },
		reversibility: Reversibility.Reversible,
		...overrides,
	};
}

function principal(overrides: Partial<SessionPrincipal> = {}): SessionPrincipal {
	return {
		source: ActionSource.User,
		permissions: [],
		...overrides,
	};
}

describe("canRevertAction", () => {
	it("lets a user revert their own reversible action with audit:revert", () => {
		const decision = canRevertAction({
			principal: principal({ userId: ada, permissions: ["audit:revert"] }),
			event: event({ actorUserId: ada }),
		});
		expect(decision.allowed).toBe(true);
		if (decision.allowed) {
			expect(decision.plan.targetEventId).toBe(eventId);
			expect(decision.plan.action).toBe("task.update.revert");
		}
	});

	it("denies a non-admin reverting another user's action (NotAuthorized)", () => {
		const decision = canRevertAction({
			principal: principal({ userId: bob, permissions: ["audit:revert"] }),
			event: event({ actorUserId: ada }),
		});
		expect(decision.allowed).toBe(false);
		if (!decision.allowed) {
			expect(decision.reason).toBe(RevertDenyReason.NotAuthorized);
		}
	});

	it("lets an admin with audit:revert:any revert another user's action", () => {
		const decision = canRevertAction({
			principal: principal({
				userId: bob,
				workspaceRole: undefined,
				isSuperAdmin: false,
				permissions: ["audit:revert:any"],
			}),
			event: event({ actorUserId: ada }),
		});
		// bob is not an admin yet -> denied
		expect(decision.allowed).toBe(false);

		const adminDecision = canRevertAction({
			principal: {
				source: ActionSource.User,
				userId: bob,
				permissions: ["audit:revert:any"],
				// workspace admin
				workspaceRole: undefined,
				isSuperAdmin: true,
			},
			event: event({ actorUserId: ada }),
		});
		expect(adminDecision.allowed).toBe(true);
	});

	it("denies an irreversible action with NotReversible and cites the reason", () => {
		const decision = canRevertAction({
			principal: principal({ userId: ada, permissions: ["audit:revert"] }),
			event: event({
				reversibility: Reversibility.Irreversible,
				irreversibleReason: "data was permanently deleted",
			}),
		});
		expect(decision.allowed).toBe(false);
		if (!decision.allowed) {
			expect(decision.reason).toBe(RevertDenyReason.NotReversible);
			expect(decision.message).toContain("data was permanently deleted");
		}
	});

	it("denies when no inverse or prior state is recorded (MissingInverse)", () => {
		const decision = canRevertAction({
			principal: principal({ userId: ada, permissions: ["audit:revert"] }),
			event: event({ before: undefined, after: { x: 1 }, inverse: undefined }),
		});
		expect(decision.allowed).toBe(false);
		if (!decision.allowed) {
			expect(decision.reason).toBe(RevertDenyReason.MissingInverse);
		}
	});

	it("denies an already-reverted event (AlreadyReverted) — idempotency", () => {
		const decision = canRevertAction({
			principal: principal({ userId: ada, permissions: ["audit:revert"] }),
			event: event({ actorUserId: ada }),
			alreadyReverted: true,
		});
		expect(decision.allowed).toBe(false);
		if (!decision.allowed) {
			expect(decision.reason).toBe(RevertDenyReason.AlreadyReverted);
		}
	});

	it("denies when dependent changes exist (DependentChanges)", () => {
		const decision = canRevertAction({
			principal: principal({ userId: ada, permissions: ["audit:revert"] }),
			event: event({ actorUserId: ada }),
			dependentEvents: [event({ id: "evt-dep" as AuditEventId })],
		});
		expect(decision.allowed).toBe(false);
		if (!decision.allowed) {
			expect(decision.reason).toBe(RevertDenyReason.DependentChanges);
		}
	});

	it("uses the explicit inverse payload when present", () => {
		const inverse = { op: "restore" };
		const decision = canRevertAction({
			principal: principal({ userId: ada, permissions: ["audit:revert"] }),
			event: event({ actorUserId: ada, inverse }),
		});
		expect(decision.allowed).toBe(true);
		if (decision.allowed) {
			expect(decision.plan.inverse).toBe(inverse);
		}
	});

	it("falls back to `before` as the inverse when no explicit inverse is given", () => {
		const before = { title: "old" };
		const decision = canRevertAction({
			principal: principal({ userId: ada, permissions: ["audit:revert"] }),
			event: event({ actorUserId: ada, before, inverse: undefined }),
		});
		expect(decision.allowed).toBe(true);
		if (decision.allowed) {
			expect(decision.plan.inverse).toBe(before);
		}
	});

	it("denies own action without audit:revert", () => {
		const decision = canRevertAction({
			principal: principal({ userId: ada, permissions: [] }),
			event: event({ actorUserId: ada }),
		});
		expect(decision.allowed).toBe(false);
		if (!decision.allowed) {
			expect(decision.reason).toBe(RevertDenyReason.NotAuthorized);
		}
	});

	it("uses a default message when an irreversible event has no reason", () => {
		const decision = canRevertAction({
			principal: principal({ userId: ada, permissions: ["audit:revert"] }),
			event: event({ reversibility: Reversibility.Irreversible }),
		});
		expect(decision.allowed).toBe(false);
		if (!decision.allowed) {
			expect(decision.message).toContain("irreversible");
		}
	});
});

describe("makeReversalEvent", () => {
	it("compensates without erasing the original", () => {
		const original = event({ actorUserId: ada });
		const snapshot = structuredClone(original);

		const reverter = principal({ userId: bob, source: ActionSource.User });
		const reversal = makeReversalEvent({
			plan: {
				targetEventId: original.id,
				action: `${original.action}.revert`,
				inverse: original.before,
			},
			principal: reverter,
			original,
			id: reversalId,
			occurredAt: now,
		});

		// original is untouched
		expect(original).toEqual(snapshot);

		// the new event points back at the original and swaps before/after
		expect(reversal.reversalOfEventId).toBe(original.id);
		expect(reversal.before).toEqual(original.after);
		expect(reversal.after).toEqual(original.before);
		expect(reversal.action).toBe("task.update.revert");
		expect(reversal.actorUserId).toBe(bob);
		expect(reversal.reversibility).toBe(Reversibility.Irreversible);
		expect(reversal.irreversibleReason).toBeDefined();

		// scope is inherited from the original
		expect(reversal.workspaceId).toBe(original.workspaceId);
		expect(reversal.targetType).toBe(original.targetType);
		expect(reversal.targetId).toBe(original.targetId);

		// the original now reads as reverted
		expect(isReverted([original, reversal], original.id)).toBe(true);
	});
});

describe("isReverted", () => {
	it("is false when nothing references the event", () => {
		expect(isReverted([event()], eventId)).toBe(false);
	});

	it("is true when some event references it via reversalOfEventId", () => {
		const reversal = event({ id: reversalId, reversalOfEventId: eventId });
		expect(isReverted([event(), reversal], eventId)).toBe(true);
	});
});
