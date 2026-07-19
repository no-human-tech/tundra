# ADR-0009: Audit trail & reversible actions

- **Status:** Accepted
- **Date:** 2026-06-28

## Context

Tundra needs accountability — a trustworthy "who did what, and when" — and, where
it is safe, the ability to undo an action. A naive design (a mutable activity row
that gets edited, or a boolean "reverted" flag toggled in place) lets history be
quietly rewritten and makes undo ambiguous about what actually happened. We also
need the undo decision to be authorized correctly: a member should be able to undo
their own mistakes, but undoing _other people's_ actions is an administrative
power. Not every action is reversible (purging data, sending an external
notification), and an undo must not clobber later, conflicting changes to the same
target. The model must compose with the identity foundation (ADR-0008) and the
unified `WorkItem`, and — like the rest of the domain — the decision logic must be
pure and testable before persistence exists.

## Decision

Model the audit trail as an **append-only, immutable** log in `@tundra/domain`.
`AuditEvent` (`Entity<AuditEventId>`) captures actor (`actorUserId?`,
`source: ActionSource` = `user | automation | extension | system`), scope
(`workspaceId?`, `projectId?`), the action (`action`, `targetType`, `targetId`),
`occurredAt`, change snapshots (`before?`, `after?`, `inverse?`), `reversibility`
(`reversible | irreversible`) with `irreversibleReason?`, a `correlationId?`, and a
`reversalOfEventId?`. Events are **only inserted** — never updated or deleted. A
revert is a **new compensating `AuditEvent`** whose `reversalOfEventId` points at
the original; the original is **never mutated**, and **"already reverted" is derived**
by scanning for such a compensating event. The revert decision is one pure function,
`canRevertAction(ctx)`, returning a `RevertDecision` (an allowed result with a
`ReversalPlan`, or a denial with a `RevertDenyReason` + message). Its rules, in
order: irreversible → `NotReversible` (cite `irreversibleReason`); no inverse/before
data → `MissingInverse`; already reverted → `AlreadyReverted` (the idempotency
guard); then the **own-vs-admin authorization split** — an ordinary member may
revert only their own reversible actions (`audit:revert`), a workspace admin may
revert others' permitted actions (`audit:revert:any` + `isWorkspaceAdmin`),
otherwise `NotAuthorized`; finally, later dependent changes on the same target →
`DependentChanges`. A successful revert applies the `inverse` and writes the
compensating event, never deleting the original. Reading the trail is gated by
`audit:read`. Persistence and materialization (db + worker), execution of inverses,
retention/tamper-evidence, and rate limiting are deferred.

## Consequences

- History is trustworthy because it is append-only: nothing — not even a revert — is
  ever edited or deleted, so the trail cannot be silently rewritten.
- Undo is a first-class, auditable action (a compensating event) rather than a
  destructive operation, and because "already reverted" is derived from that event,
  reverts are **idempotent and guarded from double-apply** by construction.
- The own-vs-admin split (`audit:revert` vs `audit:revert:any` + `isWorkspaceAdmin`)
  gives members self-service undo while keeping cross-user reverts an admin power,
  reusing the identity foundation's permissions and principal (ADR-0008).
- `canRevertAction` is pure and I/O-free: the caller supplies derived facts
  (`alreadyReverted`, `dependentEvents`) and gets a machine-readable decision, so the
  rule is unit-testable at the lowest layer and identical everywhere it is checked.
- The `DependentChanges` guard prevents an undo from clobbering newer work, at the
  cost of requiring the caller to compute later events on the same target — an
  accepted trade for safety.
- Append-only audit grows without bound; retention, export, and tamper-evidence are
  acknowledged as deferred hardening, and persistence/materialization is owned by
  `@tundra/db` and `apps/worker` in a later step.
