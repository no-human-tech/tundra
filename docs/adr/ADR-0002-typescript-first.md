# ADR-0002: TypeScript-first, strict everywhere

- **Status:** Accepted
- **Date:** 2026-06-27

## Context

Tundra's correctness hinges on a small number of precise contracts — the unified
`WorkItem` model, the domain enums, the module manifest, and the navigation rules —
shared across the database, the API, the worker, and the web shell. We want those
contracts to be checked by the compiler at every boundary, not re-described in
prose or re-validated by hand in each layer. We also want the central product rules
(the "My Tasks" aggregation, navigation scope) expressed once, in types and pure
functions, so they cannot diverge between consumers.

## Decision

Implement the entire stack in **TypeScript with `strict: true`** (plus
`noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`) via a shared base
config (`tsconfig.base.json`) that every app and package extends. The
dependency-free `@tundra/domain` package holds the canonical types and pure logic;
types flow end-to-end (`db` → `domain` → `api` → `web`). Ids are **branded string
types** to prevent cross-entity mix-ups, timestamps are **ISO date strings**, and
domain **enum string values are part of the contract** — the database mirrors them
as Postgres enums sourced directly from the domain enums so they cannot drift.

## Consequences

- A breaking change to a contract surfaces as a compile error in every consumer,
  not as a runtime bug in production.
- Branded ids catch a whole class of "passed the wrong id" defects for free.
- The product's central rules live in typed, pure functions (`selectMyTasks`,
  `navScopeOf` / `assertNavScope`) that are cheap to test exhaustively.
- Strict mode imposes upfront discipline (no implicit `any`, careful optional
  handling); this is an accepted, deliberate cost paid for long-term safety.
