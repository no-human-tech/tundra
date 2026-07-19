# Deployment Plan

This document describes how Tundra runs locally today and the intended path to
self-hosted deployment. Local development uses Docker Compose; the first
deployment target is Docker Swarm via `infra/swarm/docker-compose.yml`. Managed
cloud production deployment remains deferred unless explicitly approved.

---

## Topology

Tundra runs as three application processes over two infrastructure services:

| Process / service | What it is                  | Default port                 |
| ----------------- | --------------------------- | ---------------------------- |
| `apps/web`        | Vite + React web shell      | 5173 (Vite dev)              |
| `apps/api`        | GraphQL Yoga on Hono        | 4000 (`/graphql`, `/health`) |
| `apps/worker`     | BullMQ background processor | none (no HTTP surface)       |
| PostgreSQL        | primary datastore (Drizzle) | 5432                         |
| Redis             | queues / cache              | 6379                         |

The API is the only public surface. The worker has none. The web app reaches the
backend solely through the GraphQL endpoint.

---

## Local development with Docker Compose

The canonical local stack is Docker Compose, defined in
`infra/compose/docker-compose.yml` (referenced by `.env.example`). The default
developer workflow is:

```bash
# 1. Configure environment
cp .env.example .env

# 2. Install workspace dependencies
corepack pnpm install

# 3. Bring up Postgres + Redis (the default, no profile)
docker compose -f infra/compose/docker-compose.yml up -d

# 4. Run the apps in dev mode (Turborepo fans out to each workspace)
corepack pnpm dev
```

The compose values match the defaults in `.env.example` so a fresh checkout runs
without hand-editing. Two staged options are supported by the same compose file:

- **Infra-only compose (default, no profile)** — compose runs only Postgres +
  Redis; the three app processes run on the host via `corepack pnpm dev` (fastest
  inner loop, best for active dev).
- **Full compose (`--profile apps`)** — compose also runs `web`, `api`, and
  `worker` in containers built from `infra/docker` (closest to a deployed
  topology):

  ```bash
  docker compose -f infra/compose/docker-compose.yml --profile apps up -d --build
  ```

  On this profile the `api` service runs with `TUNDRA_DATA_SOURCE=db` and
  `NODE_ENV=development`, so on startup it migrates and dev-seeds Postgres (see
  [Database migrations](#database-migrations)) and the web container renders live
  data from the API.

Both rely on lazy connections: `apps/api` and `apps/worker` only open Postgres /
Redis connections at startup (`startServer`, `startWorker`), never at import, so
tooling and tests run without live services.

---

## Environment variables

All configuration is environment-driven, validated by `@tundra/config`
(`loadConfig`, `packages/config/src/index.ts`), whose zod schema mirrors the
repository **`.env.example`**. That file is the single reference for the accepted
variables; copy it to `.env` for local work. Categories:

- **Runtime** — `NODE_ENV`. In `db` mode the API runs idempotent dev seeding only
  when this is `development`.
- **API** (`apps/api`) — `API_HOST`, `API_PORT`, `GRAPHQL_PATH`,
  `TUNDRA_DATA_SOURCE` (`mock` | `db` — selects the in-memory mock vs the
  Postgres-backed `@tundra/db` data source; defaults to `mock`), and `CORS_ORIGIN`
  (allowed origin for the `/graphql` endpoint; `*` by default, so the browser web
  app can call the API cross-origin).
- **Web** (`apps/web`) — `VITE_API_URL` (must be `VITE_`-prefixed to reach the
  client).
- **Worker** (`apps/worker`) — `WORKER_CONCURRENCY`.
- **PostgreSQL** — `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`,
  `POSTGRES_PASSWORD`, `POSTGRES_DB`, and the full `DATABASE_URL` consumed by
  `@tundra/db`.
- **Redis** — `REDIS_HOST`, `REDIS_PORT`, `REDIS_URL`.
- **Logging / observability** — `LOG_LEVEL` (placeholder; see below).

`loadConfig` throws a single aggregated error listing every invalid variable, so
misconfiguration fails fast and clearly at startup.

---

## Dev session (no real auth yet)

There is no authentication yet. The API resolves the acting principal from a dev
request header, **`x-tundra-user-id`** (default `user-ada`). In `mock` mode this
maps to fixture principals (Ada = workspace Admin, Bob = Member); in `db` mode it
loads the principal from the database (`loadSessionPrincipal`). The header is
allow-listed by the CORS middleware so the browser web app can send it
cross-origin. This is a deliberate, clearly-bounded stand-in — real
sessions/tokens remain deferred (see
[auth-and-identity.md](./auth-and-identity.md)). When real auth lands, only the
header path in the API's context factory is replaced; the rest of the API already
consumes a resolved `SessionPrincipal`.

---

## Data source: mock vs db

`apps/api` reads and writes through a single `DataSource` port with two
interchangeable backends, selected by `TUNDRA_DATA_SOURCE`:

- **`mock`** (default) — in-memory fixtures; no database needed. Used by the
  default test suite and the quickest local start.
- **`db`** — the Postgres-backed `@tundra/db` repositories.

When `TUNDRA_DATA_SOURCE=db`, on startup the API opens a Postgres client, runs
`migrateToLatest`, and — in development (`NODE_ENV=development`) — runs the
idempotent `seedDev`, then serves from the db data source. The compose `apps`
profile sets `db` + `development` so the containerized API comes up migrated and
seeded.

---

## Database migrations

Persistence is **Drizzle over Postgres** (`@tundra/db`). The schema lives in
`packages/db/src/schema` and is the source migrations are generated from. It
covers `workspaces`, `projects`, `project_members`, `modules`, `work_items`, plus
the identity/audit tables `users`, `external_identities`,
`workspace_memberships`, and the append-only `audit_events`.

Generate and apply migrations via the package scripts:

```bash
corepack pnpm --filter @tundra/db run db:generate   # generate SQL from the schema (offline)
corepack pnpm --filter @tundra/db run db:migrate     # apply migrations to DATABASE_URL
```

The committed SQL lives in `packages/db/drizzle/` (the first migration creates the
enum types, all tables, FKs including the self-referencing
`reversal_of_event_id`, unique constraints, and indexes). `db:generate` is offline
(no DB needed); `db:migrate` reads `DATABASE_URL`.

> **Use the package scripts, not the bare `drizzle-kit` binary.** They route
> through a tsx-loader wrapper (`packages/db/scripts/drizzle-kit.mjs`) so
> drizzle-kit can resolve the repo's ESM `.js` import specifiers; the raw
> `drizzle-kit generate|migrate` fails on them. CI/deploy must call the scripts.

In `db` mode the API also applies migrations on startup (`migrateToLatest`), so a
local or containerized run never serves against an un-migrated schema. The
Postgres enum types are sourced from the domain enums
(`packages/db/src/schema/enums.ts`), so the database can never drift from the
domain contract.

### Dev seed data

`seedDev` (in `db` mode, development only) populates an idempotent dev dataset: the
`ws-tundra` workspace; users `user-ada` (Admin) and `user-bob` (Member) with email
identities and memberships; a few projects; the Helpdesk module; and WorkItems
spanning all eight `WorkItemSource` values. It is a no-op when the data already
exists, so restarts are safe. It never runs in production.

---

## Worker deployment

`apps/worker` is a standalone, long-running process with no inbound surface. It
consumes the `tundra.workitems` queue (`WORKITEMS_QUEUE`) over Redis with
configurable `WORKER_CONCURRENCY`. A single job kind exists today,
`workitems.reconcile` (`RECONCILE_JOB`, payload `{ projectId }`), handled by
`reconcileProjectWorkItems`, which calls `@tundra/db`'s idempotent upsert; in `db`
mode it reconciles against Postgres, and in mock mode it logs and no-ops. The
provider registry is deferred, so reconciliation currently runs with an empty
provider list (a structurally-correct pass that upserts nothing). Automation
actions, notification fan-out, and report rollups (see
[work-item-model.md](./work-item-model.md)) remain future work. Locally it is one
container/process; in a future deployment it scales horizontally and independently
of the API, since the queue decouples them. It must be deployed wherever the API
and database are reachable but never exposed publicly.

---

## Docker Swarm deployment

The Swarm stack lives at `infra/swarm/docker-compose.yml` and is deployed with:

```bash
docker stack deploy -c infra/swarm/docker-compose.yml tundra
```

### PostgreSQL: external, not part of the Swarm stack

**The Swarm stack does not run its own PostgreSQL.** The MVP and any production
deployment must point `DATABASE_URL` at a central Postgres instance that exists
outside the stack — self-hosted, on-premise, or managed. Supplying a `DATABASE_URL`
is a hard requirement; the stack file fails fast if it is missing.

```bash
# Example — replace with your actual connection string:
export DATABASE_URL="postgres://tundra:password@db.internal:5432/tundra?sslmode=require"
```

Rationale: running a stateful Postgres inside a Swarm service is fragile without
durable-storage node affinity and a backup strategy. Separating the datastore
from the orchestration layer makes both easier to reason about and operate. The
local development Compose file (`infra/compose/docker-compose.yml`) still runs a
local Postgres for dev and integration tests — see
[Local development with Docker Compose](#local-development-with-docker-compose).

### Operational notes

- **Backups and monitoring** for the central Postgres are the operator's
  responsibility. Nothing in this repository enforces them.
- **Migrations** run automatically: the API applies `migrateToLatest` on every
  startup in `db` mode, so a new deployment picks up schema changes without a
  separate migration step. Ensure the `DATABASE_URL` user has `CREATE TABLE` and
  `ALTER TABLE` permissions.
- **Dev seeding does not run in production.** `seedDev` only executes when
  `NODE_ENV=development`. The Swarm stack defaults to `NODE_ENV=production`, so
  the seed is never triggered.

### What the Swarm stack runs

| Service  | Description                                                           |
| -------- | --------------------------------------------------------------------- |
| `api`    | GraphQL Yoga on Hono — connects to external Postgres + in-stack Redis |
| `worker` | BullMQ processor — connects to external Postgres + in-stack Redis     |
| `web`    | Node static server (`apps/web/server.ts`) serving the pre-built SPA   |
| `redis`  | Redis 7 inside the stack (queue backend; no external dependency)      |

Swarm does not build images during stack deployment. Build and push the three app
image first (single app image, ADR-0016), then provide its registry reference
through `TUNDRA_APP_IMAGE`. The image must be built with
the public `VITE_API_URL` and, when GitHub OAuth is enabled, the public
`VITE_GITHUB_CLIENT_ID`. See `infra/swarm/README.md` for the full step-by-step
procedure.

---

## Future deployment stages (deferred)

These are intentionally out of scope for now and noted so the foundation can grow
into them without rework:

- **Staging** — a single compose-or-container deployment of `web` + `api` +
  `worker` against managed Postgres + Redis, used for integration testing before
  release. Assumes the same `@tundra/config` env contract as local.
- **Production** — horizontally scaled `api` and `worker`, managed Postgres
  (backups, PITR) and Redis, a CDN/static host for the built `web` bundle, and a
  real secrets manager. No managed infrastructure, autoscaling, or blue/green
  strategy is committed yet; **no external deployment happens without explicit
  human approval.**

---

## Observability (placeholder)

Structured logging is the only observability primitive today, gated by
`LOG_LEVEL`. Metrics, tracing, and centralized log aggregation are deliberate
placeholders for a later stage. The `GET /health` liveness probe on the API
(`apps/api/src/index.ts`) is the one operational endpoint that exists now.

---

## Security baseline

- **No secrets in the repository.** Only `.env.example` (with safe local defaults)
  is committed; real `.env` files are git-ignored and never committed.
- **Validated configuration.** `@tundra/config` validates every variable at
  startup and refuses to run on invalid input.
- **Minimal public surface.** Only the API is exposed; the worker has no inbound
  surface, and the web app never talks to the database directly.
- **Authorization seam in place.** The `PermissionHook` extension point exists for
  enforcing access control, and a resolved `SessionPrincipal` flows through every
  resolver. The acting user is currently derived from the dev `x-tundra-user-id`
  header (no tokens/crypto yet); real authentication/session issuance is deferred
  (see [auth-and-identity.md](./auth-and-identity.md) and
  [module-system.md](./module-system.md)).
- **No external deployment** and **no remote push** without explicit human
  approval.
