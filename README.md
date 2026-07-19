# Tundra

Tundra is a modular project-management and collaboration platform. It is an
independent product inspired by agile tools but designed to stand on its own,
with a small core and most functionality delivered as modules.

This repository is the **full Tundra engine** — **source-available and free to
self-host** under the [Elastic License 2.0](LICENSE) (ELv2). You may run it for
your own organization, on your own infrastructure and domain, at no cost. You
may **not** offer it to third parties as a hosted or managed service — that is
ELv2's one central limitation. ELv2 is not an OSI-approved open-source license,
which is why Tundra describes itself as source-available rather than open
source.

The hosted SaaS — **Tundra Pro** ([tundra.team](https://tundra.team)) — is a
separate commercial offering built on this engine; its commercial surface
(landing page, tenant onboarding) lives in a private repository and is not part
of this codebase.

> **Status: early source-available foundation.** The monorepo, package boundaries,
> domain contracts, and developer tooling are established, and the web app
> implements the high-fidelity Tundra design (mint/orange brand, Roboto + Roboto
> Mono, the full screen set — dashboard, projects, project board + task drawer,
> My Tasks, docs, time, extensions, settings, and more). The **first persistence
> slice is live**: the GraphQL API can run DB-backed against Postgres via
> `@tundra/db` (Drizzle migrations plus a dev seed), **My Tasks** fetches live data
> from the API (with a labelled demo fallback when it is unreachable), and the
> first reversible action (work-item status change + audit/revert) works end to
> end. There is **no real authentication yet** — the acting user comes from a dev
> request header. Most other screens still read demo fixtures. Expect rapid change;
> this is a foundation to build on, not a production-ready release.

## Why Tundra

- **Modular by default.** The core stays small; features ship as modules and plug
  in through well-defined extension points rather than being hard-wired.
- **Unified work item model.** Tasks, user-story checklist items, subtasks, bugs,
  reviews, docs follow-ups, automation actions, and extension-generated actions
  are all expressed as one coherent `WorkItem` concept.
- **"My Tasks" is a single personal work queue.** It aggregates everything
  assigned to you — tasks, story checklist items, subtasks, bugs, reviews, docs
  follow-ups, and automation/extension actions — into one unified view backed by
  the `WorkItem` model.
- **Project navigation is always project-scoped.** Inside a project the top
  navigation reflects that project's context, and global navigation and project
  navigation are kept strictly separate. Global concerns never blend into
  project-scoped menus, and vice versa.
- **Mint-dominant brand with orange accents.** A calm, professional visual
  direction where mint is the dominant identity color and orange is a restrained
  accent for primary actions and automation/extension energy.
- **TypeScript-first.** The entire stack is TypeScript with strict settings.
- **Accessibility is a requirement.** Semantic HTML, keyboard support, focus
  management, and WCAG-conscious contrast are part of the baseline, not an
  afterthought.
- **No hidden vendor lock-in.** Proprietary dependencies that trap users are
  avoided.

## Repository structure

```
apps/
  web/                # Vite + React web shell (UI, routing, navigation surfaces)
  api/                # GraphQL API service (GraphQL Yoga on Hono) — the only public surface
  worker/             # Background job processing (BullMQ on Redis)
packages/
  ui/                 # Shared UI component library and design system (mint/orange tokens)
  domain/             # Unified WorkItem model and pure domain logic (bottom of the graph)
  db/                 # Database schema, migrations, and data access (Drizzle + Postgres)
  modules-sdk/        # SDK for building Tundra modules and extension points
  config/             # Shared configuration loading and validation (zod)
  test-utils/         # Shared testing helpers and fixtures
docs/                 # Architecture, ADRs, product, deployment, and development docs
infra/                # Local infrastructure and deployment config (Docker Compose)
```

For a fuller, annotated walkthrough of every directory and the package dependency
direction, see [`docs/development/repository-structure.md`](docs/development/repository-structure.md).

## Tech stack

- TypeScript-first across the whole stack
- pnpm workspaces + Turborepo for the monorepo
- Vite + React for `apps/web`
- GraphQL Yoga served on Hono for `apps/api`
- PostgreSQL with Drizzle in `packages/db`
- Redis with BullMQ for `apps/worker`
- Vitest for tests
- Docker Compose for the local stack
- GitHub Actions for CI checks and the container image: `.github/workflows/docker.yml`
  builds the single app image on PRs and publishes `main` builds to GHCR (ADR-0017)

## Getting started

Tundra uses **pnpm** through **corepack** (bundled with Node). The package
manager version is pinned in the root `package.json`, so all commands are written
as `corepack pnpm …`.

Prerequisites:

- **Node.js >= 20.11** (corepack ships with it)
- **Docker** (for local PostgreSQL and Redis via Docker Compose)

First-time setup:

```bash
corepack enable          # activate the pinned pnpm version
corepack pnpm install    # install all workspace dependencies
cp .env.example .env     # create your local environment file
```

Start the local infrastructure (PostgreSQL + Redis) with Docker Compose, then run
the apps in development mode:

```bash
corepack pnpm dev        # runs the dev task across all apps via Turborepo
```

To run a single app's dev server, filter by its workspace name:

```bash
corepack pnpm --filter @tundra/web dev      # Vite dev server (web)
corepack pnpm --filter @tundra/api dev      # GraphQL API (tsx watch)
corepack pnpm --filter @tundra/worker dev   # background worker (tsx watch)
```

By default (`TUNDRA_DATA_SOURCE=mock`) the API serves in-memory fixtures and needs
no database. Set `TUNDRA_DATA_SOURCE=db` (with `DATABASE_URL`) to run against
Postgres; in `db` mode the API migrates and dev-seeds on startup. Generate and
apply migrations from `packages/db`:

```bash
corepack pnpm --filter @tundra/db run db:generate   # generate migration SQL
corepack pnpm --filter @tundra/db run db:migrate     # apply migrations
```

There is no real auth yet: the acting user comes from the dev `x-tundra-user-id`
request header (default `user-ada`). For the full walkthrough — environment
variables, the database/persistence setup, Docker Compose, and individual apps —
see [`docs/development/getting-started.md`](docs/development/getting-started.md).

## Quality checks

All checks are run from the repository root and fan out across the workspace via
Turborepo:

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

Browser end-to-end tests run separately from the core gate (they need a browser,
not bundled into `ci`):

```bash
corepack pnpm --filter @tundra/web e2e:install   # one-time: download Chromium
corepack pnpm e2e                                 # Playwright smoke suite
```

Run `lint`, `typecheck`, `test`, and `build` before pushing changes. See
[`docs/development/e2e-testing.md`](docs/development/e2e-testing.md) for the e2e
flow (local or against the Docker Compose stack).

## Internationalization

The web app is translated into **nine languages** — English (default), Polish,
Spanish, German, French, Italian, Chinese, Korean, and Japanese — selectable from
the language switcher in the topbar. The choice is detected from the browser and
persisted, and any missing translation falls back to English so the UI never
breaks. Locale files live in `apps/web/src/i18n/locales`, with `en.json` as the
authoritative master; verify every locale matches its key set with:

```bash
corepack pnpm --filter @tundra/web run i18n:check
```

See [`docs/architecture/internationalization.md`](docs/architecture/internationalization.md)
for the design and [`docs/development/localization.md`](docs/development/localization.md)
for how to add a key or a language. Non-English translations are initial,
AI-assisted, and native-speaker review is welcome.

## Contributing

Contributions are welcome. Start with [`CONTRIBUTING.md`](CONTRIBUTING.md) for the
setup, branch/PR flow, the small-reviewable-changes principle, commit style, and
the project guardrails. Please also read the
[Code of Conduct](CODE_OF_CONDUCT.md).

## Documentation

- **Product vision** — [`docs/product/product-vision.md`](docs/product/product-vision.md)
- **Development**
  - [`docs/development/getting-started.md`](docs/development/getting-started.md)
  - [`docs/development/repository-structure.md`](docs/development/repository-structure.md)
  - [`docs/development/testing-and-quality.md`](docs/development/testing-and-quality.md)
  - [`docs/development/e2e-testing.md`](docs/development/e2e-testing.md)
  - [`docs/development/code-style.md`](docs/development/code-style.md)
  - [`docs/development/localization.md`](docs/development/localization.md)
- **Architecture**
  - [`docs/architecture/overview.md`](docs/architecture/overview.md)
  - [`docs/architecture/domain-model.md`](docs/architecture/domain-model.md)
  - [`docs/architecture/module-system.md`](docs/architecture/module-system.md)
  - [`docs/architecture/navigation.md`](docs/architecture/navigation.md)
  - [`docs/architecture/work-item-model.md`](docs/architecture/work-item-model.md)
  - [`docs/architecture/auth-and-identity.md`](docs/architecture/auth-and-identity.md)
  - [`docs/architecture/audit-and-reversibility.md`](docs/architecture/audit-and-reversibility.md)
  - [`docs/architecture/internationalization.md`](docs/architecture/internationalization.md)
  - [`docs/architecture/deployment-plan.md`](docs/architecture/deployment-plan.md)
- **Architecture Decision Records** — [`docs/adr/`](docs/adr/)
- **Agent workflow** — [`docs/agent-workflow.md`](docs/agent-workflow.md)

## Security

To report a vulnerability, see [`SECURITY.md`](SECURITY.md). Never commit secrets;
use `.env` (ignored by git) and keep `.env.example` as the documented template.

## License

Tundra is licensed under the [Elastic License 2.0](LICENSE) (SPDX:
`Elastic-2.0`). In short: free to use, modify, distribute, and self-host for
your own organization; you may not provide Tundra to third parties as a hosted
or managed service, and you may not tamper with license keys. The licensor is
NO-HUMAN PSA, Warszawa, Poland. See the [LICENSE](LICENSE) file for the exact
terms.
