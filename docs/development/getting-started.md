# Getting Started

This guide walks you from a fresh clone to a running Tundra development
environment. Tundra is a **pnpm workspaces + Turborepo** monorepo, run through
**corepack**.

For an annotated map of the repository, see
[`repository-structure.md`](repository-structure.md). For the product context,
see [`../product/product-vision.md`](../product/product-vision.md).

## Prerequisites

- **Node.js >= 20.11** — Tundra targets Node 20 LTS or newer. corepack ships with
  Node.
- **corepack** — activates the pinned **pnpm** version declared in the root
  `package.json`. Always run pnpm as `corepack pnpm …` so you use the exact
  version the project expects.
- **Docker** — used to run local **PostgreSQL** and **Redis** via Docker Compose.

> Tundra uses Postgres (via Drizzle in `packages/db`) and Redis (for the BullMQ
> queue in `apps/worker`). Running these in Docker is the supported local setup.

## 1. Clone and install

```bash
corepack enable          # activate the pinned pnpm version
corepack pnpm install    # install all workspace dependencies
```

`corepack pnpm install` installs dependencies for every app and package in the
workspace in one pass.

## 2. Configure environment variables

Copy the example environment file and adjust values as needed:

```bash
cp .env.example .env
```

`.env` is **git-ignored** — never commit it. The committed `.env.example` is the
documented template, and its defaults match the local Docker Compose stack. The
variables it defines:

| Variable             | Purpose                                                                                                                                                                                                                            | Local default                                    |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `NODE_ENV`           | Runtime mode.                                                                                                                                                                                                                      | `development`                                    |
| `API_HOST`           | Host the API service binds to.                                                                                                                                                                                                     | `0.0.0.0`                                        |
| `API_PORT`           | Port the API service listens on.                                                                                                                                                                                                   | `4000`                                           |
| `GRAPHQL_PATH`       | Path the GraphQL endpoint is served at.                                                                                                                                                                                            | `/graphql`                                       |
| `VITE_API_URL`       | URL the web app uses to reach the GraphQL endpoint. Must be `VITE_`-prefixed to reach the client.                                                                                                                                  | `http://localhost:4000/graphql`                  |
| `TUNDRA_DATA_SOURCE` | API data backend: `mock` (in-memory fixtures) or `db` (Postgres via `@tundra/db`).                                                                                                                                                 | `mock`                                           |
| `CORS_ORIGIN`        | Comma-separated allowed origins for `/auth/*` (REST) and `/graphql`. Credentials (session cookies) require explicit origins — `*` is only accepted in `NODE_ENV=development` and causes a startup error in all other environments. | `http://localhost:5173,http://localhost:5174`    |
| `WORKER_CONCURRENCY` | Number of concurrent jobs the worker processes.                                                                                                                                                                                    | `5`                                              |
| `POSTGRES_HOST`      | PostgreSQL host.                                                                                                                                                                                                                   | `localhost`                                      |
| `POSTGRES_PORT`      | PostgreSQL port.                                                                                                                                                                                                                   | `5432`                                           |
| `POSTGRES_USER`      | PostgreSQL user.                                                                                                                                                                                                                   | `tundra`                                         |
| `POSTGRES_PASSWORD`  | PostgreSQL password (local, non-secret).                                                                                                                                                                                           | `tundra`                                         |
| `POSTGRES_DB`        | PostgreSQL database name.                                                                                                                                                                                                          | `tundra`                                         |
| `DATABASE_URL`       | Full connection string consumed by `packages/db` (Drizzle).                                                                                                                                                                        | `postgres://tundra:tundra@localhost:5432/tundra` |
| `REDIS_HOST`         | Redis host.                                                                                                                                                                                                                        | `localhost`                                      |
| `REDIS_PORT`         | Redis port.                                                                                                                                                                                                                        | `6379`                                           |
| `REDIS_URL`          | Full Redis connection string (queues / cache).                                                                                                                                                                                     | `redis://localhost:6379`                         |
| `LOG_LEVEL`          | Logging verbosity (placeholder).                                                                                                                                                                                                   | `info`                                           |

## GitHub OAuth (optional)

To enable the "Continue with GitHub" login button:

1. Create a GitHub OAuth App at <https://github.com/settings/developers>:
   - **Application name**: Tundra (local)
   - **Homepage URL**: `http://localhost:5173`
   - **Authorization callback URL**: `http://localhost:4000/auth/github/callback`

2. Copy the **Client ID** and generate a **Client secret**.

3. Add to your `.env` (copy from `.env.example`):

   ```env
   GITHUB_CLIENT_ID=<your-client-id>
   GITHUB_CLIENT_SECRET=<your-client-secret>
   GITHUB_CALLBACK_URL=http://localhost:4000/auth/github/callback
   FRONTEND_URL=http://localhost:5173
   VITE_GITHUB_CLIENT_ID=<your-client-id>
   ```

4. Restart the API and web dev servers.

The button is disabled (greyed out) automatically when these vars are absent — you do not need to set them to use email/password auth.

## 3. Start local infrastructure

PostgreSQL and Redis run via Docker Compose. The canonical local stack lives in
`infra/compose/docker-compose.yml` (its service defaults match `.env.example`).
Bring it up with:

```bash
docker compose -f infra/compose/docker-compose.yml up -d
```

This starts the local data services in the background. To stop them later:

```bash
docker compose -f infra/compose/docker-compose.yml down
```

> The deployment configuration in `infra/` is maintained by the
> deployment-engineer role and may evolve; the compose file is the source of
> truth for service names and ports.

## 4. Run the apps

To run everything in development mode at once (fanned out across the workspace by
Turborepo):

```bash
corepack pnpm dev
```

To run a single app, filter by its workspace name:

```bash
corepack pnpm --filter @tundra/web dev      # Vite dev server (web frontend)
corepack pnpm --filter @tundra/api dev      # GraphQL API on Hono (tsx watch)
corepack pnpm --filter @tundra/worker dev   # background worker (tsx watch)
```

The workspace names are:

- `@tundra/web` — the frontend (`apps/web`)
- `@tundra/api` — the GraphQL API service (`apps/api`)
- `@tundra/worker` — the background worker (`apps/worker`)

With the defaults above, the API serves GraphQL at
`http://localhost:4000/graphql` and the web app points at it via `VITE_API_URL`.

### Mock mode is the default

With `TUNDRA_DATA_SOURCE=mock` (the `.env.example` default) the API serves from
in-memory fixtures and needs **no database** — this is the fastest way to bring
the stack up. The web app's **My Tasks** screen fetches live from the API; if the
API is unreachable it falls back to clearly-labelled demo data, so the frontend
renders even with nothing running behind it. To exercise real persistence, switch
to `db` mode below.

## 5. Persistence / database

Tundra can run the API against Postgres instead of the in-memory mock. Switch
backends with the `TUNDRA_DATA_SOURCE` env var:

- `TUNDRA_DATA_SOURCE=mock` (default) — in-memory fixtures, no database needed.
- `TUNDRA_DATA_SOURCE=db` — the Postgres-backed data layer in `@tundra/db`,
  reachable via `DATABASE_URL`.

### Run the API against Postgres

```bash
# 1. Bring up Postgres + Redis (see step 3).
docker compose -f infra/compose/docker-compose.yml up -d

# 2. Point the API at the database (in your .env or the shell):
#    TUNDRA_DATA_SOURCE=db
#    DATABASE_URL=postgres://tundra:tundra@localhost:5432/tundra

# 3. Run the API (it migrates + dev-seeds on startup in development — see below).
corepack pnpm --filter @tundra/api dev
```

When `TUNDRA_DATA_SOURCE=db`, on startup the API opens a Postgres client, runs
`migrateToLatest` (applies the committed migrations), and — when
`NODE_ENV=development` — runs the idempotent `seedDev` to populate a small dev
dataset (a workspace, users **Ada** (workspace Admin) and **Bob** (Member),
projects, the Helpdesk module, and WorkItems across all eight sources). Seeding
is a no-op if the data already exists, so it is safe to restart.

> The containerized stack does this for you: the compose `apps` profile sets
> `TUNDRA_DATA_SOURCE=db` and defaults `NODE_ENV=development` on the `api`
> service, so `--profile apps up` brings the API up already migrated and seeded.

### Migrations

Schema and migrations live in `packages/db` (Drizzle). Generate SQL from the
schema and apply it via the package scripts:

```bash
corepack pnpm --filter @tundra/db run db:generate   # generate migration SQL from the schema
corepack pnpm --filter @tundra/db run db:migrate     # apply migrations to DATABASE_URL
```

Committed SQL lives in `packages/db/drizzle/`. **Always use these scripts**, not
the bare `drizzle-kit` binary: the scripts route through a small tsx-loader
wrapper (`packages/db/scripts/drizzle-kit.mjs`) so drizzle-kit can resolve the
repo's ESM `.js` import specifiers — the raw `drizzle-kit generate|migrate` fails
on them. `db:generate` is offline (no DB needed); `db:migrate` reads
`DATABASE_URL`, so make sure Postgres is running and your `.env` is configured.

### Dev session header (no real auth yet)

There is **no real authentication yet**. The API resolves the acting user from a
dev request header, `x-tundra-user-id`, defaulting to `user-ada`. In `mock` mode
this maps to fixture principals (Ada = workspace Admin, Bob = Member); in `db`
mode it loads the principal from the database. This is a deliberate stand-in —
real sessions/tokens are deferred (see
[`../architecture/auth-and-identity.md`](../architecture/auth-and-identity.md)).

To act as a specific user when calling GraphQL locally, send the header:

```bash
curl -s http://localhost:4000/graphql \
  -H 'content-type: application/json' \
  -H 'x-tundra-user-id: user-ada' \
  -d '{"query":"{ viewer { userId displayName workspaceRole isWorkspaceAdmin } }"}'
```

Omit the header to act as the default `user-ada`. The web app sends the same
header (overridable via `VITE_DEV_USER_ID`).

## 6. Quality commands

Run these from the repository root; Turborepo fans them out across all apps and
packages:

```bash
corepack pnpm lint           # ESLint across the repo
corepack pnpm typecheck      # TypeScript type checking
corepack pnpm test           # Vitest test suites
corepack pnpm build          # build all apps and packages
corepack pnpm format         # format with Prettier (writes changes)
corepack pnpm format:check   # verify formatting without writing
corepack pnpm clean          # remove build/test output
corepack pnpm run ci         # lint + typecheck + test + build (the CI gate)
```

Run `lint`, `typecheck`, `test`, and `build` before pushing changes. See
[`../../CONTRIBUTING.md`](../../CONTRIBUTING.md) for the full contribution flow.

The default `corepack pnpm test` runs DB-free. Database integration tests are
guarded and excluded from the default run; see
[`testing-and-quality.md`](./testing-and-quality.md#database-integration-tests)
for how to run them against a local Docker Postgres.

## Troubleshooting

- **`pnpm` not found / wrong version** — run `corepack enable` and always invoke
  it as `corepack pnpm …`.
- **Database or Redis connection errors** — confirm the Docker Compose stack is
  running and that your `.env` host/port values match it.
- **Migrations fail with `Cannot find module './…js'`** — you ran the bare
  `drizzle-kit` binary. Use the package scripts (`corepack pnpm --filter
@tundra/db run db:generate` / `db:migrate`), which load the tsx ESM wrapper.
- **Web app cannot reach the API** — check `VITE_API_URL` and that the API dev
  server is running on `API_PORT`. (The web app falls back to labelled demo data
  when the API is unreachable.)
