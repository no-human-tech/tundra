# Local development

How to bring up Tundra on your machine: backing datastores in Docker, apps on the
host. This complements [`infra/README.md`](../../infra/README.md), which is the
compose-stack reference. Production deployment is **out of scope** for this
foundation (architect ADR-0007); see "Out of scope" below.

## Model

Tundra's local model is deliberately split:

- **Infrastructure (Docker):** PostgreSQL and Redis run as containers from
  `infra/compose/docker-compose.yml`. They are the only things the compose stack
  starts by default.
- **Apps (host):** `apps/api`, `apps/worker`, and `apps/web` run on your host via
  `corepack pnpm dev`. They connect to the containerized datastores using the URLs
  in your local `.env`.

This keeps the inner loop fast (hot reload via `tsx watch` / Vite) while datastores
stay isolated and reproducible. Containerized app images exist under
`infra/docker/` for parity/deploy experiments but are not part of the daily loop.

## Prerequisites

- **Docker** with Compose v2 (the `docker compose` subcommand).
- **Node** `>=20.11.0` (see `engines` in the root `package.json`).
- **pnpm** via **Corepack**: `corepack enable` (pnpm version is pinned by
  `package.json` → `packageManager`, currently `pnpm@9.15.4`).

## Steps

### 1. Configure environment

```bash
cp .env.example .env
```

Edit `.env` only if you need non-default ports or values. Never commit `.env`
(it is git-ignored; only `.env.example` is tracked).

### 2. Start Postgres + Redis

```bash
docker compose -f infra/compose/docker-compose.yml up -d
```

Wait for both services to report healthy:

```bash
docker compose -f infra/compose/docker-compose.yml ps
```

### 3. Install and run the apps

```bash
corepack pnpm install
corepack pnpm dev
```

`pnpm dev` runs `turbo run dev`, starting the API (Hono + GraphQL Yoga), the worker
(BullMQ), and the web app (Vite) together.

### 4. Verify

| What       | URL                                              |
| ---------- | ------------------------------------------------ |
| API health | `http://localhost:4000/health`                   |
| GraphQL    | `http://localhost:4000/graphql`                  |
| Web app    | `http://localhost:5173`                          |
| Postgres   | `postgres://tundra:tundra@localhost:5432/tundra` |
| Redis      | `redis://localhost:6379`                         |

### 5. Tear down

```bash
docker compose -f infra/compose/docker-compose.yml down      # keep data
docker compose -f infra/compose/docker-compose.yml down -v   # drop volumes
```

## Environment variables consumed

The full, authoritative list with descriptions lives in the repo-root
[`.env.example`](../../.env.example). It is parsed and validated by
`@tundra/config` (`packages/config`). Highlights relevant to local infra:

| Variable             | Default                                          | Used by          |
| -------------------- | ------------------------------------------------ | ---------------- |
| `API_HOST`           | `0.0.0.0`                                        | apps/api         |
| `API_PORT`           | `4000`                                           | apps/api         |
| `GRAPHQL_PATH`       | `/graphql`                                       | apps/api         |
| `VITE_API_URL`       | `http://localhost:4000/graphql`                  | apps/web (build) |
| `WORKER_CONCURRENCY` | `5`                                              | apps/worker      |
| `POSTGRES_USER`      | `tundra`                                         | postgres, db     |
| `POSTGRES_PASSWORD`  | `tundra`                                         | postgres, db     |
| `POSTGRES_DB`        | `tundra`                                         | postgres, db     |
| `POSTGRES_PORT`      | `5432`                                           | postgres (host)  |
| `DATABASE_URL`       | `postgres://tundra:tundra@localhost:5432/tundra` | packages/db      |
| `REDIS_PORT`         | `6379`                                           | redis (host)     |
| `REDIS_URL`          | `redis://localhost:6379`                         | apps/worker      |

The compose file reads these from `.env` and falls back to the same defaults, so
the datastores still come up if a value is missing.

## Database migrations (deferred)

The schema/migration tooling lives in `packages/db` (Drizzle + drizzle-kit). Once
the schema is implemented, the flow against the running Postgres container will be:

```bash
# generate SQL migrations from the Drizzle schema
corepack pnpm --filter @tundra/db db:generate

# apply migrations to the database at DATABASE_URL
corepack pnpm --filter @tundra/db db:migrate
```

These commands read `DATABASE_URL` from your `.env`. They are **deferred** until
the `@tundra/db` schema lands; the scripts already exist in
`packages/db/package.json` but there is no schema to migrate yet.

## Troubleshooting

- **Port already in use:** another Postgres/Redis is bound to 5432/6379. Change
  `POSTGRES_PORT` / `REDIS_PORT` in `.env`, or stop the conflicting service.
- **App can't reach the datastore:** confirm the containers are healthy
  (`docker compose ... ps`) and that `DATABASE_URL` / `REDIS_URL` in `.env` point
  at `localhost` with the mapped ports.
- **Stale data:** reset with `down -v` to drop the `pgdata` / `redisdata` volumes,
  then `up -d` again.

## Out of scope

Production deployment — managed hosting, secrets management, scaling, TLS,
observability — is **not** part of this foundation (architect ADR-0007). The
container images under `infra/docker/` exist to keep a containerized path open and
to enable local parity testing, not as a production deployment target. The broader
deployment plan is owned by the architect
(`docs/architecture/deployment-plan.md`), not this document.
