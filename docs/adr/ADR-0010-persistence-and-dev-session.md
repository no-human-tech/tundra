# ADR-0010: Persistence backend, dev session, and the first reversible action

- **Status:** Accepted
- **Date:** 2026-06-28

## Context

The domain contracts for the unified `WorkItem`, identity/permissions (ADR-0008),
and the append-only audit trail (ADR-0009) are pure and well-tested, but until now
nothing persisted them: the API served from in-memory fixtures and `@tundra/db`
was schema plus a lazy client only. We need a first real persistence slice — a
DB-backed API in Docker, committed migrations, a seeded dev dataset, and a working
end-to-end reversible action — without (a) destabilizing the fast, DB-free
developer inner loop and default test gate, (b) forking domain or authorization
logic between an in-memory path and a Postgres path, or (c) prematurely committing
to real authentication, which remains deferred (ADR-0008). The API still needs an
acting `SessionPrincipal` on every request even though no sessions exist yet.

## Decision

Introduce a Postgres-backed data layer and select it at runtime behind a single
seam, while keeping the mock path first-class:

- **Data-source port.** `apps/api` reads and writes through one `DataSource`
  interface with two interchangeable implementations — a Postgres-backed adapter
  over the `@tundra/db` repositories and an in-memory mock over the existing
  fixtures. Resolvers never know which backend they have. The backend is chosen by
  the **`TUNDRA_DATA_SOURCE`** env var (`mock` default, `db` for Postgres);
  `CORS_ORIGIN` (default `*`) lets the browser web app call the API cross-origin.
  Aggregation (`selectMyTasks`) and revert authorization (`canRevertAction`) stay
  in `@tundra/domain` behind the port, so both backends share one rule set.

- **Dev-only header session.** With no real auth yet, the acting principal is
  resolved from a dev request header, **`x-tundra-user-id`** (default `user-ada`),
  allow-listed by CORS. In `mock` mode a fixture principal is built (Ada = Admin,
  Bob = Member); in `db` mode `loadSessionPrincipal` reads it from Postgres. This
  is an explicit, clearly-bounded stand-in for real sessions/tokens (ADR-0008);
  only the context factory's header path is replaced when auth lands.

- **Migrations + seed-on-startup.** Migrations are generated and applied with the
  `@tundra/db` package scripts (`db:generate` / `db:migrate`), which route
  `drizzle-kit` through a tsx-loader wrapper so it can resolve the repo's ESM `.js`
  import specifiers (the bare binary cannot). The committed SQL lives in
  `packages/db/drizzle/`. In `db` mode the API runs `migrateToLatest` on startup
  and, in development, the idempotent `seedDev`; the compose `apps` profile sets
  `db` + `NODE_ENV=development`, so the containerized API comes up migrated and
  seeded.

- **First reversible action.** `workitem.status_changed` is wired end to end:
  `changeWorkItemStatus` appends a reversible `AuditEvent`, `revertAuditEvent`
  applies the inverse and appends a compensating event (never mutating the
  original), and `auditHistory` reads the trail — identically in both backends,
  enforcing the own-vs-admin split and the append-only / idempotency invariants of
  ADR-0009.

- **Guarded integration tests.** DB integration tests (`*.integration.test.ts`)
  run against a real Postgres, self-skip without `TEST_DATABASE_URL` /
  `DATABASE_URL`, and are **excluded from the default `corepack pnpm test`** so the
  core gate stays DB-free and fast; unit tests cover the API (over the mock) and
  the pure mappers.

## Consequences

- The default developer experience and CI gate stay **DB-free and fast**: `mock`
  is the default, unit tests need no Postgres, and the web app falls back to
  labelled demo data when the API is unreachable. Real persistence is one env var
  away (`TUNDRA_DATA_SOURCE=db`).
- Because both backends sit behind one `DataSource` port and reuse the domain
  rules, **authorization and aggregation cannot drift** between mock and db, and
  the reversible-action PoC behaves identically in either — verified by tests in
  both and live against the Docker stack.
- The dev `x-tundra-user-id` header is **not a security boundary** — anyone who can
  reach the API can act as any user. This is an accepted trade for unblocking
  persistence ahead of auth; the seam is isolated to the context factory so the
  swap to real sessions is contained.
- Migrations must go through the package scripts, not the bare `drizzle-kit`
  binary; CI/deploy tooling has to call the scripts. Committed SQL plus
  migrate-on-startup means a `db`-mode run never serves an un-migrated schema.
- Seed-on-startup makes local/parity runs reproducible and self-populating, but is
  development-only and idempotent by design; it never runs in production.
- Integration tests being excluded by default trades guaranteed-on-every-run DB
  coverage for a fast gate; they are verified locally and the follow-up is to wire
  them into CI as a separate, service-backed job.
- Several PoC gaps are accepted and documented: no transaction wrapping around the
  status update plus audit insert, the audit event's `workspaceId` left unset on
  status change, and the worker reconcile running with an empty provider registry.

## Alternatives considered

- **Replace the mock outright with the DB.** Rejected: it would slow the inner loop
  and the test gate, require Postgres for any work, and remove the demo-fallback
  resilience of the web app. The port keeps both backends first-class.
- **Wire real authentication now.** Rejected: out of scope (ADR-0008) and far
  larger than this slice. The header session is the minimal stand-in that lets the
  whole authorization spine (principal → permissions → revert split) run against
  real data first.
- **Run integration tests in the default gate.** Rejected: it would couple every
  `pnpm test` to a running Postgres. Guarding them (self-skip without a URL) keeps
  the default DB-free while still allowing on-demand and future CI runs.
- **Use the bare `drizzle-kit` binary.** Rejected: it cannot resolve the repo-wide
  ESM `.js` import specifiers used by `@tundra/db` and `@tundra/domain`; the
  tsx-loader wrapper script is the working, committed path.
