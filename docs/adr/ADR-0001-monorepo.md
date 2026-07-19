# ADR-0001: Monorepo with pnpm workspaces and Turborepo

- **Status:** Accepted
- **Date:** 2026-06-27

## Context

Tundra is a single product made of several deployables (`web`, `api`, `worker`)
that all depend on a shared set of contracts — most importantly the unified
`WorkItem` model, the domain enums, and the navigation rules in `@tundra/domain`.
These contracts must evolve in lockstep with the apps and packages that consume
them. Splitting the codebase across multiple repositories would make a single
contract change a multi-repo, multi-PR coordination problem and would invite
version drift between the domain and its consumers. We also want fast, cached
builds and tests as the dependency graph grows, and one place for product,
architecture, ADR, and deployment documentation.

## Decision

Adopt a single monorepo using **pnpm workspaces** for dependency isolation and
strict, content-addressed installs, orchestrated by **Turborepo** for cached,
parallel task execution. The layout is `apps/{web,api,worker}` and
`packages/{domain,db,modules-sdk,ui,config,test-utils}`, with `docs/` and `infra/`
at the root. Internal packages are referenced as `workspace:*`. Cross-cutting tasks
(`lint`, `typecheck`, `test`, `build`, `dev`, `clean`) run through Turborepo with
`^build` dependency wiring, and the root `ci` script chains lint → typecheck →
test → build.

## Consequences

- A single contract change (e.g. to `WorkItem`) and all its consumers land in one
  atomic, reviewable commit; the domain and its consumers cannot drift.
- Turborepo caching keeps CI and local builds fast as the graph grows.
- The dependency direction (domain at the bottom, packages never importing apps,
  web never importing db) is enforceable in one place via workspace deps and lint
  boundary rules.
- Contributors need pnpm (via `corepack`) and must learn workspace filtering
  (`pnpm --filter @tundra/db ...`); this is the accepted cost of one-repo
  coherence.
