# Tundra — local infrastructure

This directory holds the local development infrastructure: a Docker Compose stack
for the backing datastores and (optionally) the app services.

- `compose/docker-compose.yml` — Postgres + Redis by default; `api`/`worker`/`web`
  behind the `apps` profile.
- `docker/Dockerfile.app` — one multi-stage, workspace-aware image for all
  three roles (api/worker/web — ADR-0016), used for containerized deploys and
  parity runs. Local development does not require it.

The canonical workflow: **infra provides only the datastores; you run the apps on
your host** with `corepack pnpm dev`. See also
[`docs/deployment/local-development.md`](../docs/deployment/local-development.md).

> Production deployment is intentionally out of scope for this foundation
> (architect ADR-0007).

---

## Prerequisites

- Docker (with Docker Compose v2 — the `docker compose` subcommand).
- Node `>=20.11.0` and pnpm via Corepack (`corepack enable`) for running the apps.

## 1. Create your local `.env`

All configuration lives in the **repo-root** `.env`, copied from the tracked
`.env.example`. Never commit a real `.env` (it is git-ignored).

```bash
# from the repository root
cp .env.example .env
```

The compose file reads this `.env` and falls back to the same defaults baked into
`.env.example`, so the datastores still start with a missing or partial file.

## 2. Start the datastores (default)

```bash
# from the repository root
docker compose -f infra/compose/docker-compose.yml up -d
```

This starts **only** `postgres` and `redis`. Both have healthchecks; check status
with:

```bash
docker compose -f infra/compose/docker-compose.yml ps
```

Then run the apps on your host:

```bash
corepack pnpm install
corepack pnpm dev
```

## 3. Connection URLs

These match `.env.example` and are what the host-run apps use:

| Service  | URL                                                 |
| -------- | --------------------------------------------------- |
| Postgres | `postgres://tundra:tundra@localhost:5432/tundra`    |
| Redis    | `redis://localhost:6379`                            |
| API      | `http://localhost:4000/graphql` (health: `/health`) |
| Web      | `http://localhost:5173`                             |

Host ports are configurable via `POSTGRES_PORT` / `REDIS_PORT` in `.env`.

## 4. Optional: run the full app profile in containers

For containerized parity (not needed for everyday dev), build and start the apps
too with the `apps` profile:

```bash
docker compose -f infra/compose/docker-compose.yml --profile apps up -d --build
```

With this profile the app containers connect to Postgres/Redis over the compose
network (service names `postgres` / `redis`), so the in-container `DATABASE_URL`
and `REDIS_URL` are overridden automatically. The web container serves the built
SPA via Node (`apps/web/server.ts`) on `http://localhost:5173`.

> `VITE_API_URL` is inlined at **build** time. If you change it, rebuild:
> `docker compose -f infra/compose/docker-compose.yml --profile apps build web`.

## 5. Tear down

```bash
# stop containers, keep data
docker compose -f infra/compose/docker-compose.yml down

# stop containers AND delete the Postgres/Redis volumes (clean slate)
docker compose -f infra/compose/docker-compose.yml down -v
```

Datastore state lives in named Docker volumes (`pgdata`, `redisdata`), never in
the repo tree.

## Secrets

No secrets are committed. `.env.example` carries only local placeholder values;
real configuration goes in your git-ignored `.env`. The defaults are
development-only credentials and must not be reused for any deployment.

## Docker Swarm

The self-hosted Swarm stack lives in `infra/swarm/docker-compose.yml` and is
documented in `infra/swarm/README.md`. Use it with prebuilt, pushed images:

```bash
docker stack deploy -c infra/swarm/docker-compose.yml tundra
```

Managed/cloud production deployment is still a separate decision, but this stack
provides the concrete Docker Swarm path for running the full solution.
