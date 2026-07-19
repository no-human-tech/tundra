# Architecture Overview

Tundra is a source-available, modular project-management and collaboration platform.
This document is the entry point to the architecture: the apps, the packages,
their dependency rules, the API boundary, the worker, local infrastructure, and
the testing invariants that keep the system honest.

For deeper detail see the companion documents:

- [Domain model](./domain-model.md) — every entity and its canonical TypeScript shape.
- [Work item model](./work-item-model.md) — the unified `WorkItem` and "My Tasks".
- [Module system](./module-system.md) — registry, manifest, and extension points.
- [Navigation](./navigation.md) — global vs project-scoped routing rules.
- [Auth & identity](./auth-and-identity.md) — users, providers, roles, sessions.
- [Audit & reversibility](./audit-and-reversibility.md) — append-only audit and undo.
- [Deployment plan](./deployment-plan.md) — local Docker Compose and future stages.
- [Architecture Decision Records](../adr/README.md) — the foundational ADRs.

---

## Guiding principles

- **Modular by default.** The core stays small; features are delivered as modules
  that plug into named extension points.
- **One unified work-item model.** Tasks, user-story checklist items, subtasks,
  bugs, reviews, docs follow-ups, and automation/extension actions are all the
  same `WorkItem`. The source is metadata, never a different UI layout.
- **Project navigation is always project-scoped.** Global and project navigation
  are two disjoint route namespaces that never blend.
- **TypeScript-first, strict everywhere.** Types flow end-to-end: `db` → `domain`
  → `api` → `web`.
- **No hidden vendor lock-in.** The stack favours portable, open components.

---

## Monorepo layout

A pnpm-workspace monorepo orchestrated by Turborepo.

```
apps/
  web/                # Vite + React web shell           (@tundra/web)
  api/                # GraphQL Yoga on Hono             (@tundra/api)
  worker/             # BullMQ background processor      (@tundra/worker)
packages/
  domain/             # pure domain core, zero deps      (@tundra/domain)
  db/                 # Drizzle schema + data access     (@tundra/db)
  modules-sdk/        # SDK for module authors           (@tundra/modules-sdk)
  ui/                 # shared design system             (@tundra/ui)
  config/             # env loading + validation         (@tundra/config)
  test-utils/         # fixtures + factories             (@tundra/test-utils)
docs/                 # product, architecture, adr, development, deployment
infra/                # local infrastructure (compose, docker)
```

---

## Apps

### `apps/web` — frontend web shell

Vite + React. Owns routing, layout, and the two distinct navigation surfaces
(global and project-scoped). It talks to the API exclusively over GraphQL and
hosts the frontend extension-point slots (nav entries, dashboard widgets,
work-item drawer panels, settings panels). It is a presentation and composition
layer: it holds no business rule it cannot re-derive from the API. It depends on
`@tundra/domain` (types and navigation constants) and `@tundra/ui`, and **never**
on `@tundra/db`.

### `apps/api` — GraphQL boundary

GraphQL Yoga mounted on a Hono HTTP server (see
`apps/api/src/index.ts`, `buildApp()`). This is the **only** process that exposes
a public surface. It owns the GraphQL schema (`apps/api/src/schema.ts`), input
validation, resolver orchestration, the backend extension-point registry, and (in
future) authn/authz hooks. It composes `@tundra/domain` (rules), `@tundra/db`
(persistence), `@tundra/config`, and `@tundra/modules-sdk`. The "My Tasks"
resolver delegates to the canonical `selectMyTasks` from `@tundra/domain`, so the
API enforces the same aggregation rule as everything else.

Today the API is mock-backed (`apps/api/src/mock-data.ts`); the database wiring is
deferred but the boundary and schema are real.

### `apps/worker` — background job processor

A BullMQ-style worker on Redis (`apps/worker/src/index.ts`, `startWorker()`). It
has **no public HTTP surface**. It owns all async and scheduled work:

- **WorkItem provider reconciliation** — pulling from each registered
  `WorkItemProvider` (bugs, reviews, docs follow-ups, extensions) and
  materializing the results into the unified `WorkItem` read model, idempotently.
- **Automation actions** — executing automation-generated actions.
- **Notification fan-out.**
- **Report rollups** — velocity, burndown, time summary, throughput.

The queue constant is `WORKITEMS_QUEUE` (`"tundra.workitems"`). Like the API, the
worker connects lazily at startup, never at import.

---

## Packages

| Package               | Responsibility                                                                                                                           | May depend on           |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `@tundra/domain`      | Entity types, the `WorkItem` model, enums, navigation rules, aggregation. Pure: no I/O, no framework, no db, no react.                   | _nothing internal_      |
| `@tundra/db`          | Drizzle schema, migrations, typed data access; maps rows to/from domain types.                                                           | `domain`, `config`      |
| `@tundra/modules-sdk` | The public SDK module authors build against: manifest/extension-point contracts, `WorkItemProvider`, `PermissionHook`, `ModuleRegistry`. | `domain`                |
| `@tundra/ui`          | Shared React component library and design system (mint-dominant, orange accents).                                                        | `domain` (types only)   |
| `@tundra/config`      | Environment loading and zod validation. No domain knowledge.                                                                             | _nothing internal_      |
| `@tundra/test-utils`  | Fixtures and factories (e.g. `makeWorkItem`). Imported only by tests.                                                                    | `domain`, `modules-sdk` |

`@tundra/domain` is the bottom of the graph and the single source of conceptual
truth. Everything else is expressed in its terms.

---

## Dependency direction (a hard invariant)

```
                 config        domain
                   |          /  |   \
                   |         /   |    \
                  db <------/    |     \--> modules-sdk
                   |             |            |
                   |             v            |
        +----------+----------> ui            |
        |          |            |             |
     apps/api   apps/worker   apps/web <------+
```

Rules enforced by dependency declarations (and lint boundary rules):

- `@tundra/domain` imports **nothing** internal and no runtime framework.
- `@tundra/db` may import `domain` and `config`. `@tundra/modules-sdk` may import
  `domain` only. `@tundra/ui` may import `domain` types only.
- **Packages never import apps.** Apps sit at the top and may import any package.
- The **web app never imports `db`.** Persistence is reached only through the API.

This direction is what lets the domain contracts stay stable while apps and
modules evolve above them.

---

## Frontend / backend split

- **Frontend (`apps/web`, `@tundra/ui`)** renders the product. It consumes domain
  types and navigation constants for display and never touches persistence
  directly.
- **Backend (`apps/api`, `apps/worker`, `@tundra/db`)** owns persistence,
  orchestration, and async work. The API is the single read/write boundary; the
  worker maintains derived state (the WorkItem read model, report rollups).
- **Shared (`@tundra/domain`, `@tundra/modules-sdk`, `@tundra/config`)** are
  consumed by both sides, which is exactly why they must stay free of I/O and
  framework code.

Extension points exist on both sides (see [module-system.md](./module-system.md)):
frontend slots resolve in `apps/web`; backend slots (`WorkItemProvider`,
`PermissionHook`) resolve in `apps/api` and `apps/worker`.

---

## The GraphQL API boundary

GraphQL is the single public contract between the web shell and the backend. It is
served by GraphQL Yoga because Yoga speaks the Web-standard `Request`/`Response`,
which the Hono server passes through directly (`app.all("/graphql", c =>
yoga.fetch(c.req.raw))`). Hono is chosen over Fastify for being lighter,
runtime-portable, and a clean fit for a thin server whose heavy lifting is done by
GraphQL rather than REST plugins. See
[ADR-0006](../adr/ADR-0006-graphql-api-boundary.md).

The schema is the contract. The current `Query` exposes `health`, `myTasks`,
`projects`, and `modules`; the GraphQL enums mirror the domain enums exactly
(`WorkItemSource`, `WorkItemStatus` = `todo | in_progress | blocked | done |
cancelled`, `WorkItemPriority`).

---

## Local infrastructure

The local stack is **PostgreSQL + Redis** alongside the three app processes,
brought up with Docker Compose. Configuration is environment-driven and validated
by `@tundra/config` (`loadConfig`), whose schema mirrors the repository
`.env.example`. Persistence is via **Drizzle** over Postgres (`@tundra/db`);
migrations are generated from the schema with
`corepack pnpm --filter @tundra/db db:generate`. See
[deployment-plan.md](./deployment-plan.md) for the full local workflow and future
stages.

---

## Testing strategy (summary)

Each layer tests what it owns. The list marks what exists **today** versus what
is **planned**; see [testing-and-quality.md](../development/testing-and-quality.md)
for the authoritative present-vs-deferred matrix.

- **`@tundra/domain`** _(present)_ — pure unit tests; the highest coverage bar. It
  directly proves the two critical invariants below.
- **`@tundra/db`** _(present: import-safety/schema-shape only; integration
  planned)_ — schema/migration and row ↔ domain round-trip integration tests
  against a real Postgres are deferred until persistence is wired (they need a
  database, e.g. Testcontainers or a Compose Postgres in CI).
- **`@tundra/modules-sdk`** _(present)_ — contract tests: manifests register,
  contributions land in the right slots, nav-scope violations are rejected,
  providers yield valid `WorkItem`s.
- **`apps/api`** _(present)_ — schema/resolver tests (the `myTasks` union across
  sources) over mock data.
- **`apps/worker`** _(present: import-safety only; idempotency planned)_ — the
  processor is still a placeholder, so provider-reconciliation correctness and
  idempotency tests are deferred until it does real work.
- **`apps/web`** _(present)_ — the two nav surfaces emit only their own namespace;
  My Tasks renders mixed sources with one row layout.

### The two CI-gated invariants

1. **WorkItem aggregation correctness** — every assignable source surfaces in
   "My Tasks" exactly once, with a correct `sourceRef`, `status`, and
   `assigneeId`. Anchored by `selectMyTasks` and its tests in
   `packages/domain/src/aggregation.test.ts`.
2. **Navigation separation** — no global route ever appears in project navigation
   and vice versa, for both core and module-contributed entries. Anchored by
   `navScopeOf` / `assertNavScope` and `packages/domain/src/navigation.test.ts`.

The full quality gate runs `lint`, `typecheck`, `test`, and `build` (the root
`ci` script).
