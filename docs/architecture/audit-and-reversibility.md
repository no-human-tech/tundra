# Audit & Reversible Actions

Tundra needs a trustworthy answer to **"who did what, and when"** — and, where it
is safe, a way to **undo** an action. This document defines the append-only audit
trail, the reversibility model, and the pure decision logic that decides whether a
given action may be reverted and by whom.

As with the rest of the domain, the canonical shapes and the decision function
live in `@tundra/domain` (`packages/domain/src`): pure types and pure functions,
no I/O. Persisting and materializing the audit trail is the job of `@tundra/db`
and `apps/worker` later; this phase defines the contract and the logic.

See [auth-and-identity.md](./auth-and-identity.md) for the `SessionPrincipal` and
permissions this builds on, [domain-model.md](./domain-model.md) for the shared
conventions, and [ADR-0009](../adr/ADR-0009-audit-and-reversible-actions.md) for
the decision rationale.

---

## Two principles up front

1. **The audit trail is append-only and immutable.** An audit event is written
   once and never modified or deleted. Corrections and undos are expressed as
   **new events**, never as edits to old ones. This is what makes the trail
   trustworthy: history cannot be quietly rewritten.

2. **A revert is a compensating action, not a deletion.** Undoing an action
   produces a **new compensating `AuditEvent`** whose `reversalOfEventId` points at
   the original. The original event stays exactly where it was. "Already reverted"
   is therefore a **derived** fact — found by scanning for a compensating event —
   not a mutable flag on the original.

---

## The audit event

```ts
export enum ActionSource {
	User = "user",
	Automation = "automation",
	Extension = "extension",
	System = "system",
}

export interface AuditEvent extends Entity<AuditEventId> {
	/** Absent for system/automation actions with no human actor. */
	actorUserId?: UserId;
	source: ActionSource;
	/** Scope: where the action happened. */
	workspaceId?: WorkspaceId;
	projectId?: ProjectId;
	/** What happened, e.g. "workitem.updated", "member.role_changed". */
	action: string;
	/** The kind of thing acted on, e.g. "WorkItem", "WorkspaceMembership". */
	targetType: string;
	/** Id of the target, as a string. */
	targetId: string;
	occurredAt: ISODateString;
	/** State before the action (for display and as revert input). */
	before?: Record<string, unknown>;
	/** State after the action. */
	after?: Record<string, unknown>;
	/** The minimal inverse needed to undo the action, when reversible. */
	inverse?: Record<string, unknown>;
	reversibility: Reversibility;
	/** Why an irreversible action cannot be undone (shown to the user). */
	irreversibleReason?: string;
	/** Groups events that belong to one logical operation. */
	correlationId?: string;
	/** Set on a compensating event; points at the original it reverts. */
	reversalOfEventId?: AuditEventId;
}
```

The fields cover the full "who did what and when" question:

| Question         | Field(s)                                         |
| ---------------- | ------------------------------------------------ |
| Who              | `actorUserId`, `source`                          |
| What             | `action`, `targetType`, `targetId`               |
| When             | `occurredAt`                                     |
| Where (scope)    | `workspaceId`, `projectId`                       |
| What changed     | `before`, `after`                                |
| Can it be undone | `reversibility`, `inverse`, `irreversibleReason` |
| Grouping         | `correlationId`                                  |
| Is it a revert   | `reversalOfEventId`                              |

- **`source`** reuses the same `ActionSource` enum as `SessionPrincipal.source`
  (see [auth-and-identity.md](./auth-and-identity.md)). A live request and the
  event it records share one notion of who/what is acting: `user`, `automation`,
  `extension`, or `system`. `actorUserId` is present for `user` actions and may be
  absent for `system` / `automation` ones.
- **`before` / `after`** are opaque snapshots for display.
- **`inverse`** is the minimal payload needed to undo the action. It, together with
  `before`, is what a revert applies. Its absence on a "reversible" event is a
  defect the revert logic guards against (`MissingInverse`).
- **`correlationId`** groups events from one logical operation so a multi-step
  action reads (and could be reverted) as a unit.
- **`reversalOfEventId`** is the link that makes the trail self-describing: a
  non-empty value marks the event as a compensating revert of the referenced
  original.

### Append-only, in practice

- Events are **only inserted**, never updated or deleted.
- An original event is **never mutated** — not even to mark it reverted.
- Whether an event has been reverted is computed by looking for another event with
  `reversalOfEventId === original.id`. This keeps the original immutable and makes
  the "reverted" state a pure function of the trail.

---

## Reversibility

```ts
export enum Reversibility {
	Reversible = "reversible",
	Irreversible = "irreversible",
}
```

Each audit event declares whether the action it records can, in principle, be
undone. Some actions are inherently irreversible (e.g. permanently purging data,
sending an external notification); those carry `Reversibility.Irreversible` and an
`irreversibleReason` to show the user. A `Reversible` event must also carry the
`inverse` (and usually `before`) data needed to actually perform the undo.

---

## The revert decision

Whether a specific principal may revert a specific event is decided by **one pure
function**, so the rule is testable in isolation and identical everywhere it is
checked.

```ts
export enum RevertDenyReason {
	NotFound = "not_found",
	NotReversible = "not_reversible",
	MissingInverse = "missing_inverse",
	NotAuthorized = "not_authorized",
	AlreadyReverted = "already_reverted",
	DependentChanges = "dependent_changes",
}

export interface ReversalPlan {
	targetEventId: AuditEventId;
	action: string;
	inverse: Record<string, unknown>;
}

export type RevertDecision =
	| { allowed: true; plan: ReversalPlan }
	| { allowed: false; reason: RevertDenyReason; message: string };

export function canRevertAction(ctx: {
	principal: SessionPrincipal;
	event: AuditEvent;
	/** Whether a compensating event already exists for this event (derived). */
	alreadyReverted?: boolean;
	/** Later events on the same target that would conflict with the undo. */
	dependentEvents?: readonly AuditEvent[];
	now?: ISODateString;
}): RevertDecision;
```

`canRevertAction` returns either an allowed decision carrying a `ReversalPlan`
(everything the caller needs to apply the undo) or a denial with a machine-readable
`reason` and a human-readable `message`. It performs **no I/O**: the caller supplies
the derived facts (`alreadyReverted`, `dependentEvents`) and the function decides.

### The rules, in order

1. **Not reversible** → `NotReversible`. If `event.reversibility` is
   `Irreversible`, deny and surface the event's `irreversibleReason`.
2. **Missing inverse** → `MissingInverse`. A reversible event with no `inverse`
   (and/or no `before`) data cannot actually be undone; deny rather than apply a
   bad revert.
3. **Already reverted** → `AlreadyReverted`. If a compensating event already
   exists (`alreadyReverted === true`), deny. This is the **idempotency guard**
   that prevents double-applying a revert.
4. **Authorization** — the **own-vs-admin split**:
   - An ordinary member may revert **only their own** reversible actions: the event
     must have `actorUserId === principal.userId` **and** the principal must hold
     `audit:revert`.
   - A workspace admin may revert **others'** permitted actions: the principal must
     hold `audit:revert:any` (and `isWorkspaceAdmin(principal)` is true).
   - Otherwise → `NotAuthorized`.
5. **Dependent changes** → `DependentChanges`. If later events have modified the
   same target since this event (`dependentEvents` is non-empty), the undo would
   conflict with intervening work; deny rather than silently clobber newer state.

If all checks pass, the decision is `{ allowed: true, plan }`, where the plan
carries `targetEventId`, the original `action`, and the `inverse` to apply.

### What a successful revert does

The caller (the API, later) applies the `inverse` and then **writes a new
compensating `AuditEvent`**:

- `reversalOfEventId` = the original event's `id`.
- Its own `before` / `after` reflect the undo, and it has its own actor and
  timestamp.
- The original event is **never deleted or modified** — the audit trail only grows.

Because "already reverted" is derived from the existence of that compensating
event, a second revert attempt hits the `AlreadyReverted` guard. Reverts are
therefore **idempotent and guarded from double-apply** by construction.

---

## How this composes with the rest of the system

### With identity and permissions

`canRevertAction` takes a `SessionPrincipal` and keys its authorization on
`hasPermission(principal, "audit:revert" | "audit:revert:any")` and
`isWorkspaceAdmin(principal)` (see
[auth-and-identity.md](./auth-and-identity.md)). The own-vs-admin split is exactly
the `audit:revert` (own) versus `audit:revert:any` (others) permission pair.
Reading the trail itself is gated by `audit:read`.

### With the module `PermissionHook`

Module-authored actions are recorded with `source: extension` and an
`actorUserId` for the acting user where one exists. The `permission.hooks`
extension point (see [module-system.md](./module-system.md)) can deny an action
before it happens; the audit trail records what actually did happen. The two are
complementary: hooks are the gate, audit is the record.

### With the unified `WorkItem`

Mutations to a `WorkItem` (status change, reassignment, edit) are natural audit
targets: `targetType: "WorkItem"`, `targetId` the `WorkItemId`, with `before` /
`after` snapshots and, for reversible edits, an `inverse`. This is how a work-item
change becomes both reviewable history and a candidate for undo, without coupling
the WorkItem model itself to auditing.

---

## "Who did what" and "undo" — a UX note

This phase defines the model, not the screens, but it is shaped to fit the
existing design without prescribing full UI:

- **A "who did what and when" activity history** reads directly from the audit
  trail (`audit:read`): actor, action, target, and timestamp, scoped to a project
  or to the workspace. It is the natural backing for activity feeds on a project
  and on the unified WorkItem drawer, and complements the **My Tasks** view (see
  [work-item-model.md](./work-item-model.md)) by showing what changed on the items
  a user owns.
- **An undo affordance** appears only when `canRevertAction` returns `allowed:
true` for the current principal — so members see undo on their own reversible
  actions and admins see it more broadly, exactly matching the authorization split.
  When denied, the `RevertDecision.message` gives the user a clear reason (already
  reverted, not reversible, conflicting later changes, not permitted).

Concrete components (activity feed, drawer panel, confirmation) are left to the
product-designer; the contract above is what they will render against.

---

## Implemented: first reversible action

The first end-to-end reversible action is **live** as a proof of concept:
`workitem.status_changed`. It is persisted (in `db` mode) and behaves identically
in `mock` mode, exercising the full append-only / compensating-event model above
through real GraphQL operations. Persistence lives in `@tundra/db`; the API
exposes it through the `DataSource` port; the domain still owns the decision
(`canRevertAction`) and the compensating event (`makeReversalEvent`).

### GraphQL operations

```graphql
type Mutation {
	"Change a work item's status, recording a reversible append-only audit event."
	changeWorkItemStatus(workItemId: ID!, status: WorkItemStatus!): ChangeWorkItemStatusResult!
	"Revert a previously-recorded audit event by appending a compensating event."
	revertAuditEvent(eventId: ID!): RevertResult!
}

type Query {
	"Append-only audit history for a target, oldest first."
	auditHistory(targetType: String!, targetId: ID!): [AuditEvent!]!
}
```

- **`changeWorkItemStatus(workItemId, status)`** updates the work item's status and
  **appends** an `AuditEvent` with `action: "workitem.status_changed"`,
  `targetType: "WorkItem"`, `before`/`after`/`inverse` = `{ status }`,
  `Reversibility.Reversible`, and the actor/source from the request principal. It
  returns `{ workItem, eventId }`.
- **`revertAuditEvent(eventId)`** loads the event, derives `alreadyReverted` and
  later `dependentEvents` on the same target, and runs the domain
  `canRevertAction`. On allow it applies the inverse status **and appends a
  compensating event** (`reversalOfEventId` = the original id); the original is
  never mutated or deleted. It returns `{ allowed, reason, eventId }` — on success
  `eventId` is the compensating event id and `reason` is null; on denial `reason`
  is the machine-readable `RevertDenyReason` (`not_authorized`, `already_reverted`,
  `not_reversible`, `not_found`, …) and `eventId` is null.
- **`auditHistory(targetType, targetId)`** returns the chronological trail for the
  activity feed. `before`/`after`/`inverse` are emitted as JSON strings (or null).

> Mutations to a work item carry no real session yet — the acting principal comes
> from the dev `x-tundra-user-id` header (see
> [auth-and-identity.md](./auth-and-identity.md#dev-session-current-implementation)).

### Verified behavior

The authorization split and the append-only / idempotency invariants are verified,
both as automated tests (against the mock data source and, in the guarded
integration suite, against real Postgres) and live against the Docker stack:

- **Own-vs-admin split.** A member (Bob) attempting to revert another user's
  (Ada's) action is denied with `not_authorized`; a workspace admin (Ada, holding
  `audit:revert:any`) is allowed to revert a member's action.
- **Append-only.** A successful revert writes a compensating event and restores the
  status; the **original event is retained unchanged** (asserted byte-for-byte in
  the integration test).
- **Idempotency.** A second revert of the same event is rejected with
  `already_reverted` (derived from the existing compensating event, never a mutable
  flag).
- **Guards.** Irreversible/compensating events (`not_reversible`), missing events
  (`not_found`), and later dependent changes are rejected.

### What is real vs still deferred here

Real and persisted: the `audit_events` table (append-only), the
`workitem.status_changed` action, the two mutations, `auditHistory`, and the full
authorization/idempotency behavior. Still deferred: broader audited actions
(reassignment, edits, membership changes), execution of arbitrary inverses beyond
status, retention/tamper-evidence, and rate limiting — see below.

---

## Deferred work

The pure model, persistence (`audit_events`), and the first reversible action are
now implemented (see [Implemented: first reversible action](#implemented-first-reversible-action)).
Still explicitly **out of scope**:

- **Broader audited actions and applied inverses.** The status-change action is
  wired end to end; reassignment, edits, membership changes, and applying their
  inverses are not yet implemented. `canRevertAction` produces the plan for any
  reversible event; the API only executes the status inverse so far.
- **Derived rollups / materialization** — `apps/worker` owns any precomputed
  "reverted" state or activity-feed rollups later. Today "already reverted" is
  derived on read, and there is **no transaction wrapping** the status update plus
  audit insert (an accepted PoC gap).
- **Retention, export, and tamper-evidence** (hash-chaining, signing) of the audit
  log — future hardening.
- **Rate limiting and abuse protection** on revert — added with the broader
  security hardening described in [auth-and-identity.md](./auth-and-identity.md).

---

## Security baseline

- **Append-only.** The audit trail is insert-only; no update or delete path
  exists, including for reverts (which add a compensating event).
- **No secrets in events.** `before` / `after` / `inverse` snapshots must not carry
  credentials or tokens; the audit log is a record of changes, not a secret store.
- **Fail-closed reverts.** Every denial path in `canRevertAction` returns a
  specific `RevertDenyReason`; the default posture is to deny, and the idempotency
  guard prevents double-application.
