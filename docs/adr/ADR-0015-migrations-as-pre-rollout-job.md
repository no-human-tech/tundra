# ADR-0015: Migrations as a pre-rollout Job with an advisory lock

- **Status:** Accepted
- **Date:** 2026-07-14

## Context

The API used to run Drizzle migrations on every startup. With one replica
that is convenient; with two replicas starting concurrently (k3s HA, rolling
updates) it is a race: Drizzle's migrator has no cross-process locking, so
two replicas can interleave DDL. Deployments also want migrations to happen
— and fail — _before_ new pods roll out, not during.

## Decision

Two complementary changes:

1. **`migrateToLatest` takes a Postgres session advisory lock**
   (`pg_advisory_lock`) on a dedicated connection for the whole run, so any
   concurrent migration attempts serialize — regardless of who initiates
   them.
2. **Production migrates via a dedicated Job, not on API start.** A
   standalone entrypoint (`pnpm --filter @tundra/api run migrate`) runs as a
   Kubernetes Job before each rollout. `RUN_MIGRATIONS_ON_START` defaults to
   off in production and on elsewhere (single-process dev keeps its
   convenience); an explicit value always wins.

## Consequences

- Rolling updates cannot corrupt the schema; a failed migration fails the
  Job and the rollout never proceeds with mismatched code.
- The advisory lock also covers the human-error case (Job re-run racing a
  dev-profile replica).
- CD must run the migration Job and wait for completion before
  `kubectl set image` (encoded in the Jenkins pipeline).
- Rollbacks of bad migrations remain manual (Drizzle has no down
  migrations); backward-compatible migrations stay the working rule.
