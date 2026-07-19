# ADR-0007: Local deployment with Docker Compose

- **Status:** Accepted
- **Date:** 2026-06-27

## Context

Tundra needs a reproducible local environment that a new contributor can bring up
quickly and that matches how the apps expect to run. The runtime topology is three
application processes (`web`, `api`, `worker`) over two infrastructure services
(PostgreSQL and Redis). We want one canonical way to start that stack, consistent
configuration between the apps and the services, and no secrets committed to the
repository. At this stage we explicitly do **not** want to commit to managed
infrastructure, autoscaling, or a production deployment pipeline — those decisions
are premature and would over-engineer the foundation.

## Decision

Adopt **Docker Compose** as the canonical local stack, with the compose definition
under `infra/compose` and Dockerfiles (when needed) under `infra/docker`. The
compose values mirror the defaults in the repository `.env.example`, which is the
single source of accepted environment variables (validated at startup by
`@tundra/config`). Two staged modes are supported: an **infra-only** compose
(Postgres + Redis in containers, apps via `pnpm dev` on the host) for the fastest
inner loop, and a **full** compose (all three apps containerized) for
deployment-like parity. App processes connect to Postgres/Redis lazily at startup,
never at import, so tests and tooling run without live services. Drizzle migrations
are generated from the schema with `corepack pnpm --filter @tundra/db db:generate`.
**Production deployment is out of scope** and **no external deployment happens
without explicit human approval.**

## Consequences

- A fresh checkout runs with `cp .env.example .env`, `pnpm install`, `docker
compose up`, `pnpm dev` — no hand-editing of configuration.
- Local config stays consistent with the validated env contract; misconfiguration
  fails fast.
- No secrets enter the repo: only `.env.example` (safe defaults) is committed; real
  `.env` files are git-ignored.
- Staging/production topology, managed datastores, observability, and secrets
  management are deliberately deferred; the foundation can grow into them because
  the apps already read config from one validated env contract.
- The compose and Docker files themselves are authored by the deployment-engineer;
  this ADR fixes the location and the contract they must satisfy.
