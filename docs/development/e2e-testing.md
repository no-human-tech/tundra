# End-to-end (Playwright) testing

Tundra's browser-level smoke suite lives in `apps/web/e2e/` and runs with
[Playwright](https://playwright.dev/). It exercises the **real** built web app in
a headless browser. It is intentionally separate from the Vitest unit/component
suite and from `corepack pnpm ci` so the core quality gate stays fast and does
not require a browser download.

It uses **only** a local preview server or the **local Docker Compose** stack —
never an external or cloud service.

## What it covers

`apps/web/e2e/app.spec.ts` asserts the minimum agreed scenarios:

- **App boot** — `/` redirects to `/dashboard`, the page title is `Tundra`, and
  the app shell (banner, global nav, `#tnd-main`) renders.
- **Global/project navigation separation** — a global route shows only the
  `Global` nav (no `Project` nav); a project route shows the `Project` nav, every
  project-nav link is under `/projects/:projectId/`, and neither nav links into
  the other's namespace.
- **My Tasks mixed-source rendering** — `/my-tasks` renders work-item rows with
  one row component, each source surfaced as a `data-source` metadata badge (never
  a per-source layout). The assertion is **mode-independent**: it checks the six
  distinct sources present in **both** the live seed and the demo fixtures, so it
  passes whether the page is showing live API data (Mode 2) or the demo fallback
  (Mode 1).

## One-time setup: install the browser

Playwright needs a browser binary (not committed, not bundled):

```bash
corepack pnpm --filter @tundra/web e2e:install
# equivalently: corepack pnpm --filter @tundra/web exec playwright install chromium
```

## Mode 1 — local quick run (no Docker)

Playwright builds the app and serves it with `vite preview` on port `4173`
automatically, then runs the suite:

```bash
corepack pnpm e2e
# or: corepack pnpm --filter @tundra/web e2e
```

This is the fastest path and is what you use for day-to-day development. **No API
or database runs in this mode**, so the web app's My Tasks screen lands on its
labelled demo fallback ("Demo data — API unavailable"); the e2e assertions are
written to hold against that fallback. The demo "My Tasks" fixtures are bundled
into the web app.

## Mode 2 — against the local Docker Compose stack

Run the same suite against the containerized web app talking to the **real
DB-backed API** (and the Postgres + Redis datastores) for parity with a deployed
setup. The `apps` profile sets `TUNDRA_DATA_SOURCE=db` and defaults
`NODE_ENV=development` on the `api` service, so on startup the API migrates and
dev-seeds Postgres; the web container then renders **live** My Tasks (no demo
marker). Set `E2E_BASE_URL` so Playwright targets the running container instead of
starting its own server.

```bash
# 1. Create your local env file (first time only).
cp .env.example .env

# 2. Bring up the full local stack (postgres, redis, api, web).
docker compose -f infra/compose/docker-compose.yml --profile apps up -d --build

# 3. Run the e2e suite against the web container (served on :5173).
#    POSIX shells (bash/zsh, Git Bash):
E2E_BASE_URL=http://localhost:5173 corepack pnpm --filter @tundra/web e2e
#    PowerShell:
#      $env:E2E_BASE_URL = "http://localhost:5173"; corepack pnpm --filter @tundra/web e2e; Remove-Item Env:E2E_BASE_URL

# 4. Tear down and remove local volumes when done (safe — local only).
docker compose -f infra/compose/docker-compose.yml --profile apps down -v
```

### Teardown & cleanup (safe by design)

- `docker compose ... down` stops and removes the containers.
- The `-v` flag also removes the named volumes `pgdata` and `redisdata`. These are
  **local development volumes only** (see `infra/compose/docker-compose.yml` and
  `.gitignore`); removing them resets local state and never touches any remote or
  shared resource.
- Omit `-v` if you want to keep local database state between runs.
- Playwright artifacts (`apps/web/test-results/`, `apps/web/playwright-report/`)
  are git-ignored. `corepack pnpm --filter @tundra/web clean` removes them.

## Viewing the report

```bash
corepack pnpm --filter @tundra/web exec playwright show-report
```

## CI note

E2E is **not** part of `corepack pnpm ci` (which is `lint → typecheck → test →
build`) so the gate stays browserless and fast. To run e2e in CI, add a separate
job that runs `corepack pnpm --filter @tundra/web e2e:install` then `corepack
pnpm e2e` (Mode 1) — no Docker required, since the suite is mode-independent and
passes against the demo fallback. For full live coverage of the DB-backed API, a
second job can bring up the Compose `apps` profile and run Mode 2 with a
Compose-backed `E2E_BASE_URL`.
