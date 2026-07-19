# The Unified WorkItem Model

The `WorkItem` is the spine of Tundra. Every assignable thing in the product —
a task, a user-story checklist item, a subtask, a bug, a review, a documentation
follow-up, an automation action, or an extension-generated action — is the **same**
`WorkItem` concept. The kind of thing it came from is recorded as metadata, never
as a different UI layout.

This is what makes "My Tasks" a single, coherent personal work queue instead of a
pile of disconnected lists. The model and its aggregation rule live in
`@tundra/domain` (`packages/domain/src/work-item.ts` and
`packages/domain/src/aggregation.ts`). See
[ADR-0003](../adr/ADR-0003-unified-work-item-model.md) for the decision.

---

## The model

```ts
export interface WorkItemSourceRef {
	source: WorkItemSource;
	/** Id of the originating entity (TaskId, ChecklistItemId, …) as a string. */
	refId: string;
	/** Optional module id when source is Extension/Automation. */
	moduleId?: ModuleId;
}

export interface WorkItem extends Entity<WorkItemId> {
	/** every WorkItem is project-scoped */
	projectId: ProjectId;
	/** discriminator: type of the originating entity */
	source: WorkItemSource;
	/** link back to origin */
	sourceRef: WorkItemSourceRef;
	title: string;
	status: WorkItemStatus;
	priority: WorkItemPriority;
	/** drives "My Tasks" aggregation */
	assigneeId?: UserId;
	dueDate?: ISODateString;
	sprintId?: SprintId;
	/** free-form module/provider payload; the host treats it as opaque for display */
	metadata?: Record<string, unknown>;
}
```

Two fields make aggregation and filtering possible across all sources:

- **`assigneeId`** — who owns the item. "My Tasks" is the set of WorkItems for the
  current user.
- **`status`** — the lifecycle state (`todo | in_progress | blocked | done |
cancelled`). Terminal statuses (`done`, `cancelled`) drop out of the default
  view.

`sourceRef` is the stable back-reference to the originating entity, so any WorkItem
can link back to its origin (and `metadata` carries source-specific payload the
host treats as opaque for display).

---

## The eight source types

`WorkItemSource` (`packages/domain/src/enums.ts`) is a data discriminator, **never
a layout variant**:

| `source` value    | Originating entity          | Notes                                          |
| ----------------- | --------------------------- | ---------------------------------------------- |
| `task`            | `Task` (no `parentTaskId`)  | A standalone task.                             |
| `story_checklist` | `ChecklistItem`             | An item on a user story's checklist.           |
| `subtask`         | `Task` (has `parentTaskId`) | A task nested under another task.              |
| `bug`             | module-provided             | Bugs are a module source, not a core table.    |
| `review`          | module-provided             | Reviews are a module source, not a core table. |
| `docs`            | module-provided             | Documentation follow-ups.                      |
| `automation`      | `AutomationAction`          | Automation-generated actions.                  |
| `extension`       | module-provided             | Generic extension-generated actions.           |

Core sources (`task`, `subtask`, `story_checklist`, `automation`) come from core
domain entities. `bug`, `review`, `docs`, and `extension` are contributed by
modules through `WorkItemProvider`s — keeping the core small while exercising the
extension seam (see [module-system.md](./module-system.md)).

---

## How a user-story checklist item surfaces in My Tasks

This is the canonical illustration of the model. A `UserStory` decomposes into
ordered `ChecklistItem`s, each of which can carry its own `assigneeId`:

```ts
export interface ChecklistItem extends Entity<ChecklistItemId> {
	storyId: UserStoryId;
	projectId: ProjectId;
	text: string;
	done: boolean;
	/** an assigned checklist item must surface in My Tasks */
	assigneeId?: UserId;
	order: number;
}
```

When a checklist item is assigned, it is materialized into a `WorkItem`:

| WorkItem field | Sourced from                                              |
| -------------- | --------------------------------------------------------- |
| `source`       | `WorkItemSource.StoryChecklist` (`"story_checklist"`)     |
| `sourceRef`    | `{ source: "story_checklist", refId: <ChecklistItemId> }` |
| `title`        | `ChecklistItem.text`                                      |
| `assigneeId`   | `ChecklistItem.assigneeId`                                |
| `status`       | `done ? WorkItemStatus.Done : WorkItemStatus.Todo`        |
| `projectId`    | `ChecklistItem.projectId`                                 |

The assignee now sees that checklist item in "My Tasks" sitting alongside their
tasks, bugs, and reviews — in the same row layout, distinguished only by a source
badge. The same materialization pattern applies to every source: each maps to one
WorkItem with the correct `source`, `sourceRef`, `assigneeId`, and `status`.

---

## How modules contribute work items

Non-core sources arrive through the backend `WorkItemProvider` extension point
(`packages/modules-sdk/src/contracts.ts`):

```ts
export interface WorkItemProvider {
	source: WorkItemSource;
	listForProject(ctx: ProviderContext, projectId: ProjectId): Promise<WorkItem[]>;
}
```

- A module registers a provider (discovered via
  `ModuleRegistry.workItemProviders()`).
- `apps/worker` periodically reconciles each provider's output into the unified
  `WorkItem` read model, **idempotently** — re-running a provider must not create
  duplicates.
- Core sources (tasks, checklist items, automation) are materialized synchronously
  by `apps/api` on write; provider sources are reconciled by the worker. Either
  way, the read model is the single place "My Tasks" reads from.

This is also how future integrations (GitHub issues, Discourse topics) will feed
the queue without the core learning about external systems.

---

## API implications: one `myTasks` query over the read model

"My Tasks" is a **single query over the WorkItem read model**, filtered by
assignee and status. It never queries source tables. The rule is the pure
`selectMyTasks` function in `packages/domain/src/aggregation.ts`:

```ts
export interface MyTasksFilter {
	assigneeId: UserId;
	projectId?: ProjectId; // optional narrowing
	includeStatuses?: WorkItemStatus[]; // default: every status except Done/Cancelled
	sources?: WorkItemSource[]; // optional narrowing
}

export function selectMyTasks(items: WorkItem[], filter: MyTasksFilter): WorkItem[];
```

Filtering order: assigned to `assigneeId` → status (in `includeStatuses` if given,
otherwise active-only via `isActiveStatus`) → optional `projectId` → optional
`sources`. The function is pure and order-preserving.

The GraphQL API uses this exact function. The `myTasks(assigneeId: ID!)` resolver
in `apps/api/src/schema.ts` calls `selectMyTasks`, so the API's behaviour is the
same single-query-over-the-read-model rule — there is one definition of "My
Tasks", shared by the domain layer and the API.

---

## Frontend implications: one row layout, source as metadata

Because the source is metadata, the frontend renders **one WorkItem row layout**
for every item in "My Tasks", regardless of origin. The `source` drives a badge
and the deep-link target (via `sourceRef`), not a different component. Source-
specific detail is surfaced through **work-item drawer panels** (the
`workitem.drawer` extension point), so a bug can show bug-specific fields without
forking the list layout. This is what keeps "My Tasks" visually coherent while
aggregating many kinds of work.

---

## Testing implications: the aggregation correctness invariant

**WorkItem aggregation correctness is one of the two CI-gated invariants** (see
[overview.md](./overview.md)). The contract:

> Every assignable source surfaces in "My Tasks" exactly once, with a correct
> `sourceRef`, `status`, and `assigneeId`.

This is anchored by `selectMyTasks` and its tests in
`packages/domain/src/aggregation.test.ts`, which exercise the function across all
eight `WorkItemSource` values plus the status, assignee, source, and project
filters. Because the function is pure, these tests are deterministic and cheap,
which is exactly why the product's central rule is enforced at the lowest, most
stable layer.

Worker-level tests asserting that provider reconciliation is idempotent (no
duplicate WorkItems on re-run) are **planned, not yet implemented** — the worker
processor is still a placeholder. See
[testing-and-quality.md](../development/testing-and-quality.md).

---

## The Epic / User Story / Task hierarchy

Tundra uses a three-level hierarchy for planning and tracking work within a
project. **Each level is a distinct domain concept, not a WorkItem subtype.**
WorkItems are the aggregation layer; the hierarchy is the planning layer.

```
Epic
 └── UserStory  (one or more per Epic)
      └── Task   (one or more per UserStory)
           └── ChecklistItem  (ordered, assignable steps within a Task)
```

### Epic

An `Epic` is the highest-level planning unit. It groups related user stories that
share a common goal or delivery milestone. Epics have a title, a description, an
optional target date, and a progress indicator derived from the completion of their
child stories. An Epic does not directly carry work; it is a container.

### UserStory

A `UserStory` belongs to exactly one Epic and represents a valuable capability from
a user's perspective. It has:

- A title and optional acceptance criteria.
- An ordered list of `ChecklistItem`s — the concrete steps needed to meet the
  acceptance criteria. Each checklist item carries its own `assigneeId`, which is
  how story-level work becomes a `WorkItem` in "My Tasks".
- A `status` (`todo | in_progress | done`) aggregated from its checklist items by
  the domain rule: a story is `done` only when all its checklist items are done.

### Task

A `Task` is the atomic unit of work. It belongs to a `UserStory` (or exists
standalone when `parentStoryId` is null). It maps 1:1 to a `WorkItem` with
`source = "task"` (standalone) or `source = "subtask"` (nested under another
task). Every `Task` can appear on the Board as a card in one of the five board
columns (`Backlog`, `Ready`, `In Progress`, `Review`, `Done`).

### How the hierarchy surfaces in the Board's phase swimlanes

The Board groups columns into three **workflow phases** at the presentation layer:

| Phase        | Columns             |
| ------------ | ------------------- |
| `Planning`   | Backlog, Ready      |
| `Execution`  | In Progress, Review |
| `Deployment` | Done                |

This mapping is purely a view concern (`PHASE_FOR_COLUMN` in
`apps/web/src/pages/project/ProjectPages.tsx`). It does not change the domain
model — the column a card lives in is determined by the Task's `status` field; the
phase is derived at render time for grouping purposes only.

### Relationship to WorkItem

| Hierarchy entity | WorkItem `source`   | Condition                           |
| ---------------- | ------------------- | ----------------------------------- |
| `ChecklistItem`  | `story_checklist`   | `assigneeId` set                    |
| `Task` (root)    | `task`              | `parentTaskId` null                 |
| `Task` (nested)  | `subtask`           | `parentTaskId` set                  |
| `UserStory`      | — (no direct entry) | Stories surface via checklist items |
| `Epic`           | — (no direct entry) | Epics are planning containers only  |

Neither `Epic` nor `UserStory` produces a `WorkItem` directly. Work is always
tracked at the `Task` or `ChecklistItem` level, keeping the "My Tasks" list
actionable and free of planning noise.
