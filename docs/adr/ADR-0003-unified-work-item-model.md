# ADR-0003: Unified WorkItem model

- **Status:** Accepted
- **Date:** 2026-06-27

## Context

Work in Tundra arrives from many origins: regular tasks, subtasks, user-story
checklist items, bugs, reviews, documentation follow-ups, automation actions, and
extension-generated actions. The "My Tasks" view must aggregate **all** of a user's
assigned work into one coherent personal queue. Modeling each origin as its own
list type would force "My Tasks" to fan out across many queries and many UI
layouts, would couple the core to every source type (including ones that should be
modules, like bugs and reviews), and would make a unified queue effectively
impossible to keep consistent.

## Decision

Adopt **one `WorkItem` entity** with a `WorkItemSource` discriminator
(`task | story_checklist | subtask | bug | review | docs | automation |
extension`) and a `sourceRef` back-reference to the originating entity. The source
is **metadata, never a UI layout variant** — every WorkItem renders with the same
row layout. Each assignable source entity is materialized into exactly one
`WorkItem` carrying `assigneeId` and `status`. "My Tasks" is then a **single query
over the WorkItem read model**, expressed by the pure `selectMyTasks` function in
`@tundra/domain` and used unchanged by the GraphQL `myTasks` resolver. Core sources
are materialized synchronously by the API on write; module-provided sources (bug,
review, docs, extension) are reconciled into the read model by the worker via
`WorkItemProvider`s.

## Consequences

- "My Tasks" is one fast query regardless of how many source types exist, and one
  visual layout regardless of origin.
- Bugs, reviews, and docs follow-ups can ship as modules rather than core tables,
  keeping the core small and exercising the extension seam from day one.
- There is exactly one definition of "My Tasks" (the `selectMyTasks` function),
  shared by the domain and the API, so behaviour cannot diverge.
- The worker-maintained read model introduces eventual consistency for
  provider-sourced items, and reconciliation must be idempotent; this is the
  accepted trade for a unified, single-query queue.
- **Aggregation correctness** (every source surfaces exactly once with a correct
  `sourceRef`, `status`, and `assigneeId`) becomes a CI-gated invariant.
