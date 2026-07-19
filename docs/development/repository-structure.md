# Repository Structure

Tundra is a **pnpm workspaces + Turborepo** monorepo. This document is an
annotated map of every top-level directory, each app and package's
responsibility, and the dependency direction that keeps the codebase honest.

For setup and commands, see [`getting-started.md`](getting-started.md).

## Top-level layout

```
apps/        # runnable applications (web, api, worker)
packages/    # shared libraries consumed by the apps and by each other
docs/        # architecture, ADRs, product, deployment, and development docs
infra/       # local infrastructure and deployment config (Docker Compose)
```

Plus root-level configuration:

- `package.json` — root scripts (`dev`, `build`, `lint`, `typecheck`, `test`,
  `format`, `format:check`, `clean`, `ci`), the pinned pnpm version, and shared
  dev tooling.
- `pnpm-workspace.yaml` — declares the workspaces: `apps/*` and `packages/*`.
- `turbo.json` — Turborepo task pipeline (how tasks fan out and cache).
- `tsconfig.base.json` — the base TypeScript config extended by each workspace.
- `eslint.config.js`, `.prettierrc.json` — lint and format configuration.
- `.env.example` — documented template for local environment variables.
- `CLAUDE.md` / `AGENTS.md` — instructions for the Claude Code executor and the
  Codex supervisor, respectively.

## Apps (`apps/*`)

Apps sit at the **top** of the dependency graph. They compose packages; **no
package ever imports an app.**

### `apps/web` — `@tundra/web`

The frontend: a **Vite + React** web shell. It owns routing, layout, the two
distinct navigation surfaces (global vs project-scoped), data fetching, module
registration, and page composition. It talks to the API **exclusively over
GraphQL**. It depends on `@tundra/ui` (design system) and `@tundra/domain` (view
types). It deliberately **never imports `@tundra/db`** — the browser has no
business touching persistence.

### `apps/api` — `@tundra/api`

The GraphQL API service: **GraphQL Yoga served on Hono**. It is the **only
process that exposes a public surface**. It owns the public schema, resolver
orchestration, input validation, the backend extension-point registry, and (later)
auth hooks. It composes `@tundra/domain` (rules), `@tundra/db` (persistence),
`@tundra/config`, and `@tundra/modules-sdk`, and enqueues background work to the
worker via Redis.

### `apps/worker` — `@tundra/worker`

The background processor: **BullMQ on Redis**. It owns asynchronous and scheduled
work — materializing work items from non-core/provider sources, automation
actions, notification fan-out, and report rollups. It has **no public HTTP
surface**. It composes `@tundra/domain`, `@tundra/db`, and `@tundra/config`.

## Packages (`packages/*`)

Packages are shared libraries. Their import rules are strict so the graph stays
acyclic and the domain core stays pure.

### `packages/domain` — `@tundra/domain`

The **pure domain core** and the bottom of the dependency graph. It holds the
entity types, the unified `WorkItem` model, the `WorkItemSource` discriminator,
enums, invariants, the navigation-rule constants and validators, and pure
aggregation functions (such as the "My Tasks" selection). It has **no I/O, no
framework, no database, no React** — it imports nothing internal. It is the single
source of conceptual truth that types flow out of.

### `packages/db` — `@tundra/db`

The persistence layer: **Drizzle** schema, migrations, and typed data access. It
maps persistence rows to and from `@tundra/domain` types. It depends only on
`@tundra/domain` and `@tundra/config`. It exposes a `./schema` entry point and
provides database tooling scripts (`db:generate`, `db:migrate`).

### `packages/modules-sdk` — `@tundra/modules-sdk`

The **public SDK module authors build against**: the module manifest type, the
extension-point contracts, the `WorkItemProvider` interface, the permission-hook
contract, and the module registry helpers. It depends only on `@tundra/domain`.

### `packages/ui` — `@tundra/ui`

The shared **React component library and design system**: the mint/orange design
tokens, primitives, and the presentational navigation/app-shell shells. It depends
on `@tundra/domain` for shared view types only and exposes `./tokens.css` and
`./styles.css`. It **must never import `@tundra/db` or `@tundra/api`.** React is a
peer dependency.

### `packages/config` — `@tundra/config`

Shared **configuration loading and validation** (zod). It validates and exposes
environment configuration. It is pure and has **no domain knowledge**; it is
depended on by the apps and by `@tundra/db`.

### `packages/test-utils` — `@tundra/test-utils`

Shared **testing helpers and fixtures** (factories such as `makeWorkItem` and
sample data). It depends on `@tundra/domain` and `@tundra/modules-sdk`, and is
**only imported by tests**.

## `docs/`

Project documentation:

- `docs/architecture/` — architecture overview, domain model, module system,
  navigation, work-item model, and deployment plan.
- `docs/adr/` — Architecture Decision Records (Context / Decision / Consequences).
- `docs/product/` — product vision and product docs.
- `docs/deployment/` — deployment documentation.
- `docs/development/` — developer guides (this file, getting started).
- `docs/agent-workflow.md` — how the AI-assisted workflow and subagents fit
  together.

## `infra/`

Local infrastructure and deployment configuration. The canonical local stack is a
Docker Compose definition (`infra/compose/docker-compose.yml`) that provides
PostgreSQL and Redis (and, as it grows, the app services) with defaults that match
`.env.example`. Production deployment is out of scope at this stage.

## Dependency direction

The graph flows **downward into `domain`** and **upward into the apps**. The rules
are invariants, enforced by `package.json` dependencies and lint boundary rules:

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

- `@tundra/domain` imports **nothing** internal — it is the bottom of the graph.
- `@tundra/db` may import `@tundra/domain` and `@tundra/config`.
- `@tundra/modules-sdk` may import `@tundra/domain` only.
- `@tundra/ui` may import `@tundra/domain` (types only); it **never** imports
  `@tundra/db` or `@tundra/api`.
- Apps sit at the top and may import any package; **packages never import apps**.
- The **web app never imports `@tundra/db`** — persistence is reached only through
  the GraphQL API.

These rules keep the domain core reusable and dependency-free, prevent circular
dependencies, and ensure the only public surface is the API.
