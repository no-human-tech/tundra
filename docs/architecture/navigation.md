# Navigation

Tundra has **two disjoint navigation namespaces**: global navigation and
project-scoped navigation. Keeping them separate is a hard architectural
invariant — global concerns never leak into a project menu, and project concerns
never leak into the global menu. There is no third, blended menu.

The rules and route constants live in `@tundra/domain`
(`packages/domain/src/navigation.ts`) so both the web shell and the module
registry enforce the same contract. See
[ADR-0004](../adr/ADR-0004-project-scoped-navigation.md) for the decision and
[module-system.md](./module-system.md) for how module nav contributions are
validated.

---

## Two namespaces

- **Global navigation** is the workspace-level shell: Dashboard, Projects, My
  Tasks, Time, Reports, Extensions, Workspace Settings. It is rendered from
  `GLOBAL_NAV`.
- **Project navigation** appears when you are inside a project and is always
  project-scoped: Overview, Backlog, Board, Sprints, Time, Wiki, Discussions,
  Reports, Settings. It is rendered from `PROJECT_NAV`. Every project route
  carries the active `:projectId`.

`apps/web` renders exactly two nav components, one fed by `GLOBAL_NAV` and one by
`PROJECT_NAV`. Both lists derive their routes from the canonical route constants,
so the menus can never drift from the routes.

---

## Allowed global routes

From `GLOBAL_ROUTES` (`packages/domain/src/navigation.ts`):

| Key                 | Route         | Nav label          |
| ------------------- | ------------- | ------------------ |
| `dashboard`         | `/dashboard`  | Dashboard          |
| `projects`          | `/projects`   | Projects           |
| `myTasks`           | `/my-tasks`   | My Tasks           |
| `time`              | `/time`       | Time               |
| `reports`           | `/reports`    | Reports            |
| `extensions`        | `/extensions` | Extensions         |
| `workspaceSettings` | `/settings`   | Workspace Settings |

`/projects` (the project **list**) is a global route. Anything addressing a
specific project (`/projects/:projectId/...`) is a project route.

---

## Allowed project routes

From `PROJECT_ROUTE_PATTERNS`:

| Key           | Route pattern                      | Nav label   |
| ------------- | ---------------------------------- | ----------- |
| `overview`    | `/projects/:projectId/overview`    | Overview    |
| `backlog`     | `/projects/:projectId/backlog`     | Backlog     |
| `board`       | `/projects/:projectId/board`       | Board       |
| `sprints`     | `/projects/:projectId/sprints`     | Sprints     |
| `time`        | `/projects/:projectId/time`        | Time        |
| `wiki`        | `/projects/:projectId/wiki`        | Wiki        |
| `discussions` | `/projects/:projectId/discussions` | Discussions |
| `reports`     | `/projects/:projectId/reports`     | Reports     |
| `settings`    | `/projects/:projectId/settings`    | Settings    |

The web shell substitutes the active project id for `:projectId` at render time.

Concrete examples:

```
Global:   /dashboard   /projects   /my-tasks   /extensions
Project:  /projects/TUN/overview   /projects/TUN/board
          /projects/TUN/wiki       /projects/TUN/settings
```

Note that "Time" and "Reports" exist in **both** namespaces and are distinct: the
global ones aggregate across the workspace; the project ones are scoped to a single
project. They are different routes, not a shared one.

---

## The forbidden-mixing rule

> **Global navigation must never link to a project-scoped route, and project
> navigation must never link to a global route.**

A route is classified purely by its shape: it is **project-scoped** if and only if
it begins with `/projects/:projectId/`; everything else (including the `/projects`
list) is **global**.

```ts
export type NavScope = "global" | "project";

export function navScopeOf(routePattern: string): NavScope {
	return /^\/projects\/:projectId\//.test(routePattern) ? "project" : "global";
}

export function assertNavScope(routePattern: string, declared: NavScope): void {
	if (navScopeOf(routePattern) !== declared) {
		throw new Error(`Nav scope violation: ${routePattern} is not ${declared}-scoped`);
	}
}
```

`assertNavScope` is the single enforcement point. It throws on any mismatch
between a route and its declared scope, so a violation is rejected loudly rather
than rendered silently.

---

## How enforcement works

1. **Core navigation.** `GLOBAL_NAV` and `PROJECT_NAV` are built directly from
   `GLOBAL_ROUTES` and `PROJECT_ROUTE_PATTERNS`, so the core menus are correct by
   construction and cannot drift from the route definitions.
2. **Module contributions.** A module that wants a nav entry contributes to either
   the `global.nav` or `project.nav` slot, carrying the route it links to (see
   [module-system.md](./module-system.md)). At registration,
   `ModuleRegistry.register` looks up the slot's required scope in
   `NAV_SLOT_SCOPE` and calls `assertNavScope(route, required)`. A global-scoped
   module trying to add a project link (or vice versa) is **rejected at
   registration time**, before anything is recorded.
3. **Tests.** `packages/domain/src/navigation.test.ts` proves `navScopeOf` and
   `assertNavScope` accept correct pairings and throw on violations, and that the
   nav lists are scoped and complete. **Navigation separation is one of the two
   CI-gated invariants** (see [overview.md](./overview.md)).

Because the core lists, the module registry, and the tests all route through the
same `navScopeOf` / `assertNavScope` pair, there is exactly one rule and no way to
blend the two namespaces.
