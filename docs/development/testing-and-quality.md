# Testing & Quality

How Tundra tests itself, what the quality gates are, and how to add tests for new
code. This document is owned by the `qa-engineer` role. It does not cover repo
setup or how to run the stack locally — see
[getting-started.md](./getting-started.md) for that.

The guiding principle: **practical tests that protect the product rules, without
overloading a young codebase.** We test the core domain hard and pure, keep the
edges (I/O, framework wiring) thin and lightly covered, and defer expensive
integration/e2e tooling until there is something stable to integrate against.
Every layer must still pass typecheck, lint, and build.

---

## The two non-negotiable invariants (CI-gated)

Two product rules from [CLAUDE.md](../../CLAUDE.md) are encoded as explicit,
exhaustively-iterating "invariant" suites. They are not ordinary unit tests — they
exist to make a product-rule regression a build failure. They must always pass;
they run as part of `corepack pnpm test` and therefore inside `corepack pnpm ci`.

1. **Navigation separation (global vs project).**
   `packages/domain/src/navigation-invariant.test.ts`
   — describe block `INVARIANT: navigation separation (global vs project)`.
   Asserts, iterating **every** entry in `GLOBAL_NAV` / `PROJECT_NAV` and the
   underlying `GLOBAL_ROUTES` / `PROJECT_ROUTE_PATTERNS` constants:
   - every `GLOBAL_NAV` route resolves to `navScopeOf() === "global"`;
   - every `PROJECT_NAV` route resolves to `navScopeOf() === "project"`;
   - the two lists are disjoint — no global route appears in `PROJECT_NAV` and no
     project route appears in `GLOBAL_NAV`;
   - `assertNavScope` throws when a global route is declared `project` and when a
     project route is declared `global`, and does **not** throw for correctly
     scoped pairings.
     Rationale: "Global navigation and project navigation must stay separate." A
     mis-scoped route added to either list breaks the build.

2. **WorkItem aggregation correctness (My Tasks).**
   `packages/test-utils/src/aggregation-invariant.test.ts`
   — describe block `INVARIANT: WorkItem aggregation correctness (My Tasks)`.
   Runs the real `selectMyTasks` from `@tundra/domain` against the shared
   `sampleWorkItems` fixtures and asserts:
   - **all eight** `WorkItemSource` values are represented in the fixtures
     (exhaustive — iterates `Object.values(WorkItemSource)`);
   - `selectMyTasks` returns only the requested assignee's items;
   - `Done` / `Cancelled` are excluded by default;
   - the returned set spans **multiple** sources (proving "My Tasks" is unified,
     not task-only);
   - every returned item's `sourceRef.source` matches its `source`;
   - the `sources` and `projectId` filters narrow correctly;
   - `includeStatuses` overrides the default active-only behaviour.
     Rationale: "My Tasks aggregates assigned work … into a single unified view."

These two files live next to ordinary unit tests but are the canonical guardrails.
If you change navigation or aggregation behaviour, expect to update them
deliberately — do not weaken an assertion to make a change pass.

> Why the aggregation invariant lives in `@tundra/test-utils`, not `@tundra/domain`:
> `@tundra/domain` is dependency-free and must not depend on `@tundra/test-utils`.
> The invariant deliberately exercises the **shared fixtures** (which depend on
> the domain), so it belongs in the package that owns those fixtures. The domain
> package keeps its own inline-constructed unit tests (`aggregation.test.ts`).

---

## Test pyramid, layer by layer

Bottom of the pyramid is the widest and cheapest; the top is narrow and deferred.

| Layer                | Package / app         | Kind                                        | Bar                                               | Status                                               |
| -------------------- | --------------------- | ------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------- |
| Domain core          | `@tundra/domain`      | Pure unit                                   | **Highest** — exhaustive, no I/O                  | Present                                              |
| Config               | `@tundra/config`      | Pure unit                                   | High — schema/validation                          | Present                                              |
| Modules SDK          | `@tundra/modules-sdk` | Contract unit                               | High — registry/slot/scope rules                  | Present                                              |
| Fixtures + invariant | `@tundra/test-utils`  | Unit over fixtures                          | High — aggregation invariant                      | Present                                              |
| DB                   | `@tundra/db`          | Pure mapper units + guarded integration     | High — mappers exhaustive; integration on real PG | Present (integration guarded, excluded from default) |
| API                  | `apps/api`            | Resolver/schema unit (mock data source)     | Medium — query execution + revert PoC             | Present                                              |
| Worker               | `apps/worker`         | Pure provider-collection + import-safety    | Light now; idempotency later                      | Present                                              |
| Web                  | `apps/web`            | Component/smoke (Vitest) + e2e (Playwright) | Medium                                            | Present                                              |

### Domain (`@tundra/domain`) — the highest bar

The domain is pure (types + pure functions, no I/O, no framework), so it gets the
strictest, most exhaustive tests. Tests iterate enums and constant lists rather
than spot-checking, so adding a value forces a decision. Because the package is
dependency-free, its tests **construct `WorkItem`s inline** (a local `wi()`
helper) and import only from the source under test or `@tundra/domain`. They never
import `@tundra/test-utils`.

Present: `aggregation.test.ts`, `navigation.test.ts`, and the CI-gated
`navigation-invariant.test.ts`.

### Config (`@tundra/config`)

`loadConfig` is a pure function over an env object. Tests cover: defaults parse,
overrides + coercion, the result is deep-frozen, and invalid values (bad port,
bad log level) throw. No real environment is read in tests — env is passed in.

Present: `config.test.ts`.

### Modules SDK (`@tundra/modules-sdk`) — contract tests

The `ModuleRegistry` is the module/extension contract. Tests cover: slot routing,
duplicate-id rejection, nav-scope rejection in **both** directions (a global nav
contribution to a project slot and vice versa), and that a discovered
`WorkItemProvider` yields a valid `WorkItem`. This is where module-side navigation
separation is re-enforced at registration time.

Present: `module-registry.test.ts`.

### Test utils (`@tundra/test-utils`)

Owns the shared fixtures (`makeWorkItem`, `sampleWorkItems` covering all eight
sources, `sampleProjects`, `sampleModules`) and the CI-gated aggregation
invariant. Fixtures use fixed ISO timestamps (never `Date.now()`) so they are
stable and snapshot-friendly. Tests here may import both `@tundra/domain` and the
local fixtures.

Present: `aggregation-invariant.test.ts`.

### DB (`@tundra/db`) — pure mapper units + guarded integration

`@tundra/db` has two test tiers:

- **Unit (default `pnpm test`, NO database).** `schema/schema.test.ts` proves
  import-safety (the schema exports tables; the lazy client opens no socket at
  import). `mappers.test.ts` round-trips `WorkItem` / `Project` / `User` /
  `AuditEvent` between persistence rows and domain types, asserts the append-only
  insert row carries no `updatedAt`, and asserts **enum alignment** — every
  domain enum value (`WorkItemSource`, `WorkItemStatus`, `WorkItemPriority`,
  `WorkspaceRole`, `ActionSource`, `Reversibility`) is present in the
  corresponding `pgEnum.enumValues`, so the database can never drift from the
  domain contract.
- **Integration (guarded, EXCLUDED from the default run).** `*.integration.test.ts`
  exercises the real repositories against a live Postgres. See
  [Database integration tests](#database-integration-tests) below.

Present: `schema/schema.test.ts`, `mappers.test.ts` (units);
`repos.integration.test.ts` (guarded integration).

### Database integration tests

The repository layer (migrations, principal resolution, My Tasks selection, the
status-change reversible action and revert) is covered by
`packages/db/src/repos.integration.test.ts` against a real Postgres. These tests
are **guarded and excluded from the default `corepack pnpm test`** by design —
the default gate stays DB-free and fast.

- They connect to `TEST_DATABASE_URL` (falling back to `DATABASE_URL`) and
  **self-skip** when neither is set, so the default run never fails for lack of a
  database.
- `beforeAll` runs `migrateToLatest`, truncates all tables, then `seedDev`, so
  each run starts from a clean, seeded baseline; mutating tests insert their own
  dedicated rows to stay isolated.
- They assert the persistence-level invariants: seed idempotency; mixed-source My
  Tasks (Done excluded); principal resolution (Ada admin with
  `audit:revert:any`); `changeWorkItemStatus` → audit insert + history; the
  **append-only** guarantee on revert (the original row is byte-for-byte
  unchanged, a compensating event is written, status is restored);
  already-reverted rejection; admin-reverts-member; member-cannot-revert-another;
  and not-found cases.

Run them against a local Docker Postgres:

```bash
# 1. Start a throwaway Postgres (or reuse the compose one).
docker run -d --name tundra-itest \
  -e POSTGRES_USER=tundra -e POSTGRES_PASSWORD=tundra -e POSTGRES_DB=tundra_test \
  -p 55432:5432 postgres:16-alpine

# 2. Run the guarded suite with a TEST_DATABASE_URL.
#    POSIX shells (bash/zsh, Git Bash):
TEST_DATABASE_URL="postgres://tundra:tundra@localhost:55432/tundra_test" \
  corepack pnpm --filter @tundra/db test:integration
#    PowerShell:
#      $env:TEST_DATABASE_URL = "postgres://tundra:tundra@localhost:55432/tundra_test"
#      corepack pnpm --filter @tundra/db test:integration
#      Remove-Item Env:TEST_DATABASE_URL
```

`test:integration` runs only `*.integration.test.ts` (via a dedicated
`vitest.integration.config.ts`). Verified: 11/11 pass against
`postgres:16-alpine`; the suite self-skips with no URL set.

### API (`apps/api`) — resolver/schema tests over the mock data source

The GraphQL schema is built so a single `graphql` realm is shared by Yoga and the
test's `graphql()` call. Tests execute real operations against the **mock data
source** (`createMockDataSource()`, the in-memory backend the resolvers read and
write through) — no HTTP server, no DB. `buildApp()` is side-effect free and binds
no port when imported. Because the mock and Postgres backends share one
`DataSource` interface and reuse the same domain logic (`selectMyTasks`,
`canRevertAction`), these tests exercise the real query and authorization rules
without a database.

Coverage:

- **`viewer.test.ts`** — the resolved principal reflects Ada (Admin, holds
  `audit:revert:any`, `isWorkspaceAdmin: true`) and Bob (Member).
- **`schema.test.ts`** — mixed-source `myTasks` (asserts `task`,
  `story_checklist`, and `extension` are present and Done/Cancelled excluded),
  `myTasks` defaulting to the viewer, `health`, projects + modules.
- **`audit.test.ts`** — the reversible-action PoC end to end through the schema:
  `changeWorkItemStatus` records an event that `auditHistory` returns; an actor
  can revert their **own** action; a non-admin **cannot** revert another's
  (`not_authorized`); an admin **can** revert a member's; already-reverted and
  irreversible events are rejected; and the **append-only** guarantee (original
  retained, compensating event written, status restored) holds.

Present: `viewer.test.ts`, `schema.test.ts`, `audit.test.ts`.

### Worker (`apps/worker`) — provider collection + idempotency to come

The reconcile step is split so its pure part is testable with no I/O:
`collectProviderItems(projectId, providers)` (provider-collection) is unit-tested
with fake providers and no database, and the index test proves the queue constant
and that importing the module opens no Redis connection. The DB-touching
`reconcileProviderWorkItems` upsert is idempotent by id and covered at the
`@tundra/db` integration layer. When the processor grows real provider wiring,
add **idempotency tests** (the same job twice yields one effect) and failure/retry
behaviour.

Present: `reconcile.test.ts`, `index.test.ts`.

### Web (`apps/web`) — component + smoke + e2e

Component and smoke tests (render, accessibility roles, the two-nav-component
separation in the shell) run here with Vitest + Testing Library and `jsdom`.
Accessibility is a product requirement, so prefer role/name queries and assert
semantic structure rather than implementation details.

Browser-level **end-to-end** tests run with Playwright (`apps/web/e2e/`), covering
app boot, navigation separation, and My Tasks mixed-source rendering. They run
either locally (`vite preview`) or against the local Docker Compose stack, and are
deliberately kept out of `corepack pnpm ci` (browserless, fast). See
[e2e-testing.md](./e2e-testing.md).

Present: `src/__tests__/MyTasks.test.tsx`, `src/__tests__/NavigationSeparation.test.tsx`
(Vitest); `e2e/app.spec.ts` (Playwright).

---

## Quality gates

### What runs

`corepack pnpm ci` (root script) runs, in order:

```
lint  →  typecheck  →  test  →  build
```

- **lint** — `eslint .` across the repo.
- **typecheck** — `turbo run typecheck` → `tsc --noEmit` per package (strict mode,
  `noUncheckedIndexedAccess`, `isolatedModules`). Test files live under `src` and
  are typechecked too.
- **test** — `turbo run test` → `vitest run --passWithNoTests` per package. This is
  where the two invariants run.
- **build** — `turbo run build`. For the TS-only packages and apps this is also
  `tsc --noEmit`; `apps/web` builds with Vite.

CI (`.github/workflows/ci.yml`) must run the **same** four gates so local and CI
agree. Adding a separate, divergent CI command is an anti-pattern — CI calls the
same scripts.

### Coverage philosophy

No enforced coverage thresholds yet — thresholds on a young codebase produce
busywork and brittle gates rather than confidence. Instead:

- The **two invariants must always pass.** They are the real floor.
- The domain core is held to exhaustive, not percentage-based, coverage (iterate
  enums and constant lists; do not spot-check).
- Coverage thresholds are **deferred** until the surface stabilises. When
  introduced, gate per-package (start with `@tundra/domain`) rather than a single
  global number, and ratchet up, never down.

---

## How to run tests

From the repo root, using the pinned package manager via corepack:

- **Everything:** `corepack pnpm test`
- **One package:** `corepack pnpm --filter @tundra/domain test`
  (replace with `@tundra/config`, `@tundra/modules-sdk`, `@tundra/db`,
  `@tundra/test-utils`, `@tundra/api`, `@tundra/worker`, `@tundra/web`).
- **Watch mode (TDD) for one package:**
  `corepack pnpm --filter @tundra/domain exec vitest`
- **Full local gate (matches CI):** `corepack pnpm ci`
- **Just the invariants, quickly:**
  `corepack pnpm --filter @tundra/domain test` and
  `corepack pnpm --filter @tundra/test-utils test`
- **Browser e2e (separate from `ci`):** `corepack pnpm e2e` (see
  [e2e-testing.md](./e2e-testing.md)).

### Forcing a fresh, uncached run

Turbo caches successful `test`/`build` results keyed by each package's files and
its declared dependencies, so a code or dependency change always re-runs. (Every
workspace declares its own `vitest`, so test runs resolve deterministically rather
than relying on a hoisted copy.) To prove a run is not served from cache, pass
`--force` **as a Turbo flag** — i.e. before any `--`:

```bash
corepack pnpm test --force        # turbo run test --force  (re-runs all, 0 cached)
corepack pnpm exec turbo run test --force
```

Do **not** write `corepack pnpm test -- --force`: the `--` makes Turbo forward
`--force` through to `vitest`, which rejects it as an unknown option. The flag is
Turbo's cache-bust, not a vitest flag.

---

## Adding tests for a new package

1. **Co-locate.** Put `*.test.ts` next to the code under `src/`. No separate test
   tree, no per-package `vitest.config.ts` unless a package genuinely needs one
   (the web app will, for a DOM environment).
2. **Use the package's `test` script.** Every package already defines
   `"test": "vitest run --passWithNoTests"`, so `turbo run test` picks it up with
   no extra wiring.
3. **Import test globals explicitly.** `tsconfig.base.json` sets `types: []`, so
   Vitest globals are **not** ambient. Start every test file with
   `import { describe, expect, it } from "vitest";` (mirroring the existing
   suites).
4. **Respect package boundaries.** `@tundra/domain` stays dependency-free — never
   import `@tundra/test-utils` from inside it. Anything that needs shared fixtures
   either lives in `@tundra/test-utils` or in a package that already depends on it.
5. **Prefer pure, deterministic tests.** Pass inputs in (env, dates, ids) rather
   than reading real environment or `Date.now()`. Use the `@tundra/test-utils`
   fixtures where a realistic `WorkItem`/`Project`/`Module` is needed.
6. **Iterate, don't spot-check, for closed sets.** When asserting over enums or
   the nav/route constants, iterate `Object.values(...)` / the arrays so new
   values cannot silently escape coverage.
7. **Mind `noUncheckedIndexedAccess`.** Indexing arrays/records yields `T |
undefined`; assert with `!` only when a fixture guarantees the element (as the
   existing fixtures do, e.g. `sampleProjects[0]!`).

---

## Deferred / next QA steps

- **DB integration tests in CI.** The guarded `repos.integration.test.ts` suite
  exists and passes locally against Docker Postgres (see
  [Database integration tests](#database-integration-tests)); wiring it into CI as
  a separate, Compose-or-service-backed job (so it runs on every change rather than
  only on demand) is the next step.
- **Worker idempotency + retry tests** once the processor has real provider wiring:
  same job twice → one effect; failures retry as configured.
- **Automated accessibility checks** (e.g. `axe-core`) on top of the existing web
  component/smoke tests (`apps/web/src/__tests__/`, which already assert the two
  separate nav components and mixed-source rendering).
- **Coverage thresholds**, starting with `@tundra/domain`, ratcheting up over time.

> **Web e2e is now present** — a Playwright smoke suite (`apps/web/e2e/`) covers
> app boot, navigation separation, and My Tasks mixed-source rendering, runnable
> locally or against the local Docker Compose stack. It is kept out of
> `corepack pnpm ci` (browserless, fast) and run via `corepack pnpm e2e`. See
> [e2e-testing.md](./e2e-testing.md).
