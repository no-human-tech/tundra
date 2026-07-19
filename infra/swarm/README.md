# Tundra — Docker Swarm stack

This directory contains the Swarm-ready stack file:

- `docker-compose.yml` — deploys `web`, `api`, `worker`, and Redis.

The local development compose file in `infra/compose/` is intentionally separate.
It uses local `build`, profiles, and `container_name`, which are not appropriate
for `docker stack deploy`.

---

## Architecture: external Postgres, internal Redis

**PostgreSQL is not part of this Swarm stack.** The stack requires a central
Postgres instance that is provisioned, backed up, and monitored outside of Docker
Swarm. Supply its connection string via `DATABASE_URL` before deploying.

**Redis is managed inside the stack** as a lightweight queue backend (`redisdata`
named volume). Replace it with an external Redis if your deployment requires it.

The local development Compose file (`infra/compose/docker-compose.yml`) still
runs a local Postgres container for development and integration tests — those are
completely separate from this Swarm stack.

---

## Step-by-step: local Swarm deployment

### 1. One-time: initialize Swarm (if not already active)

```bash
docker swarm init
```

Verify: `docker info --format "{{.Swarm.LocalNodeState}}"` → `active`.

### 2. Build images from the repository root

```bash
TAG=local

# One image for all roles (api/worker/web) — ADR-0016.
docker build \
  -f infra/docker/Dockerfile.app \
  --build-arg VITE_API_URL=http://localhost:4000/graphql \
  --build-arg VITE_GITHUB_CLIENT_ID= \
  -t tundra/app:${TAG} .
```

`VITE_API_URL` and `VITE_GITHUB_CLIENT_ID` are baked in at **build time** by
Vite. When deploying to a real host, replace `localhost` with the public API URL.

For a registry deployment (optional):

```bash
docker push registry.example.com/tundra/app:TAG
```

### 3. Set required environment variables

```bash
export TUNDRA_APP_IMAGE=tundra/app:local

# Central Postgres — required. Never commit a real connection string.
# Supports ?sslmode=require and any other libpq parameter.
export DATABASE_URL="postgres://user:password@db.internal:5432/tundra?sslmode=require"

# Public web origin (no trailing slash).
export CORS_ORIGIN=http://localhost:5173
export FRONTEND_URL=http://localhost:5173

# Default published ports — override if busy.
export API_PUBLISHED_PORT=4000
export WEB_PUBLISHED_PORT=5173
```

Optional GitHub OAuth:

```bash
export GITHUB_CLIENT_ID='<github-client-id>'
export GITHUB_CLIENT_SECRET='<github-client-secret>'
export GITHUB_CALLBACK_URL=http://localhost:4000/auth/github/callback
```

No secrets belong in this repository. Inject real values from your shell, CI/CD
secret store, or Swarm secrets management.

### 4. Validate the stack file

```bash
docker compose -f infra/swarm/docker-compose.yml config --quiet
```

No output means valid. Required variables that are missing produce a clear error
naming the variable.

### 5. Deploy

```bash
docker stack deploy -c infra/swarm/docker-compose.yml tundra
```

### 6. Check status

```bash
# Service replicas (REPLICAS column should show 1/1 or N/N).
docker stack services tundra

# Per-task state.
docker stack ps tundra

# Logs per service.
docker service logs tundra_api
docker service logs tundra_worker
docker service logs tundra_web
```

### 7. Smoke test

```bash
# API liveness — expect {"status":"ok"}
curl http://localhost:4000/health

# GraphQL (minimal)
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __typename }"}'

# Web SPA — expect <!doctype html>
curl http://localhost:5173/
```

API logs: `docker service logs tundra_api` should show:

```
Tundra API data source: db (Postgres)
Tundra API listening on http://0.0.0.0:4000/graphql
```

No migration errors or crash loops.

### 8. Tear down

```bash
# Remove the stack (keeps the Redis volume).
docker stack rm tundra

# Remove the stack AND delete the Redis volume (clean slate).
docker stack rm tundra
docker volume rm tundra_redisdata
```

---

## Required environment variables summary

| Variable               | Required | Description                                     |
| ---------------------- | -------- | ----------------------------------------------- |
| `TUNDRA_APP_IMAGE`     | ✅       | Pushed app image reference (all roles)          |
| `DATABASE_URL`         | ✅       | Central Postgres connection string              |
| `CORS_ORIGIN`          | ✅       | Public web origin (allowed by API CORS)         |
| `FRONTEND_URL`         | ✅       | Public web origin (OAuth redirect target)       |
| `API_PUBLISHED_PORT`   | —        | Published port for API (default: 4000)          |
| `WEB_PUBLISHED_PORT`   | —        | Published port for web (default: 80)            |
| `GITHUB_CLIENT_ID`     | —        | GitHub OAuth client id (leave empty to disable) |
| `GITHUB_CLIENT_SECRET` | —        | GitHub OAuth client secret                      |
| `GITHUB_CALLBACK_URL`  | —        | GitHub OAuth callback URL                       |

## Public ports

| Service | Default port | Configurable via     |
| ------- | ------------ | -------------------- |
| web     | 5173 (→ 80)  | `WEB_PUBLISHED_PORT` |
| api     | 4000         | `API_PUBLISHED_PORT` |

## Local dev and integration tests

**Do not use the Swarm stack for local development or DB integration tests.**
Use the local Docker Compose file instead:

```bash
# Start local Postgres + Redis:
docker compose -f infra/compose/docker-compose.yml up -d

# Run DB integration tests against local Postgres:
TEST_DATABASE_URL="postgres://tundra:tundra@localhost:5432/tundra" \
  corepack pnpm --filter @tundra/db test:integration

# Tear down:
docker compose -f infra/compose/docker-compose.yml down -v
```

## Build and push for registry deployment

```bash
docker build -f infra/docker/Dockerfile.app \
  --build-arg VITE_API_URL=https://api.example.com/graphql \
  --build-arg VITE_GITHUB_CLIENT_ID=<client-id-or-empty> \
  -t registry.example.com/tundra/app:TAG .

docker push registry.example.com/tundra/app:TAG
```
