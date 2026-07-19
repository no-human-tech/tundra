# Module System

Tundra's core stays small. Features are delivered as **modules** that plug into a
closed, named set of **extension points**. This document covers the module
registry, the `ModuleManifest`, the extension-point slots, the backend
`WorkItemProvider` and `PermissionHook` contracts, the frontend/backend split, and
the scope-validation rule that keeps navigation contributions honest.

The contracts live in `@tundra/modules-sdk` (`packages/modules-sdk/src`), which
depends only on `@tundra/domain`. Module authors build against this single SDK.

See also [domain-model.md](./domain-model.md) for the manifest types and
[ADR-0005](../adr/ADR-0005-module-system.md) for the decision rationale.

---

## How the pieces relate

```
ModuleManifest (declaration)
      |  contributes[]: ExtensionPoint[]
      v
ModuleRegistry (authoritative index)
      |  - rejects duplicate module ids
      |  - validates nav contributions against slot scope (assertNavScope)
      |  - indexes contributions by slot
      v
Extension points (named slots)
      |
      +-- frontend slots --> resolved/rendered by apps/web
      +-- backend slots  --> WorkItemProvider, PermissionHook
                              resolved by apps/api and apps/worker
```

- The **`ModuleManifest`** is the static declaration a module ships (see
  [domain-model.md](./domain-model.md)). Its `contributes` array lists the
  extension points the module targets, each referencing a named `slot`.
- The **`ModuleRegistry`** (`packages/modules-sdk/src/module-registry.ts`) is the
  authoritative, in-memory index of registered modules. On registration it
  rejects duplicate ids, validates nav-scope, and indexes every contribution by
  slot for fast `contributionsForSlot(slot)` lookups. It also tracks registered
  `WorkItemProvider`s so the worker can discover them.
- An **extension point** is a named, typed slot. Modules contribute to slots; the
  host renders (frontend) or invokes (backend) the contributions for each slot.

---

## The named slots

The closed initial set of slots is defined in
`packages/modules-sdk/src/slots.ts` as the `SLOTS` constant, mapped to the
`ExtensionPointKind` enum from `@tundra/domain`.

| Slot constant (`SLOTS.*`) | Slot string          | `ExtensionPointKind` | Surface  | Purpose                                                          |
| ------------------------- | -------------------- | -------------------- | -------- | ---------------------------------------------------------------- |
| `globalNav`               | `global.nav`         | `NavEntry`           | frontend | Add a **global** nav entry (must target a global route)          |
| `projectNav`              | `project.nav`        | `NavEntry`           | frontend | Add a **project-scoped** nav entry (must target a project route) |
| `dashboardWidgets`        | `dashboard.widgets`  | `DashboardWidget`    | frontend | Tiles on the global dashboard                                    |
| `workitemDrawer`          | `workitem.drawer`    | `TaskDrawerPanel`    | frontend | Panels inside the WorkItem (task) drawer                         |
| `projectSettings`         | `project.settings`   | `SettingsPanel`      | frontend | Tabs in project settings                                         |
| `workspaceSettings`       | `workspace.settings` | `SettingsPanel`      | frontend | Tabs in workspace settings                                       |
| `workitemProviders`       | `workitem.providers` | `WorkItemProvider`   | backend  | Feed WorkItems into "My Tasks"                                   |
| `permissionHooks`         | `permission.hooks`   | `PermissionHook`     | backend  | Authorize / deny actions                                         |

The slot name is the string a module references in its manifest's
`contributes[].slot`. The registry indexes by this string.

---

## Frontend extension points

Resolved and rendered by `apps/web`:

- **Navigation entries** (`global.nav`, `project.nav`) — contribute a labelled
  link into one of the two nav surfaces. Subject to the scope-validation rule
  below.
- **Dashboard widgets** (`dashboard.widgets`) — tiles on the global dashboard.
- **Work-item drawer panels** (`workitem.drawer`) — panels shown inside the
  unified WorkItem drawer. Because every WorkItem uses one layout, drawer panels
  are how source-specific detail is presented without forking the layout.
- **Settings panels** (`project.settings`, `workspace.settings`) — tabs in
  project or workspace settings, respectively.

## Backend extension points

Resolved by `apps/api` and `apps/worker`. The SDK defines these in
`packages/modules-sdk/src/contracts.ts`:

```ts
/** Read-only context the host supplies to backend extensions. */
export interface ProviderContext {
	userId?: UserId;
	workspaceId: WorkspaceId;
}

/** Feeds WorkItems into the unified read model; the worker reconciles them. */
export interface WorkItemProvider {
	source: WorkItemSource;
	/** Pull the current WorkItems for a project. */
	listForProject(ctx: ProviderContext, projectId: ProjectId): Promise<WorkItem[]>;
}

/** Authorizes actions; hooks are composed with AND across all modules. */
export interface PermissionHook {
	can(
		ctx: ProviderContext,
		action: string,
		subject: Record<string, unknown>,
	): boolean | Promise<boolean>;
}
```

- **`WorkItemProvider`** is the specialized backend extension point that lets a
  module contribute WorkItems (bugs, reviews, docs follow-ups, extension actions)
  into the unified read model **without the core knowing those source types
  intrinsically**. The worker discovers providers via
  `ModuleRegistry.workItemProviders()` and reconciles their output idempotently
  (see [work-item-model.md](./work-item-model.md)).
- **`PermissionHook`** lets a module authorize actions. Hooks are composed with
  **AND**: any hook returning `false` denies the action. This is the seam where
  real authorization will be enforced once authentication lands.
- Modules never receive a raw `db` handle. The host supplies a read-only
  `ProviderContext`; future host accessors hang off that object.

---

## The scope-validation boundary rule

The two navigation slots are the only place a module can influence routing, and
they are tightly bounded: a `global.nav` contribution may only target a **global**
route, and a `project.nav` contribution may only target a **project-scoped**
route. This is the module-side enforcement of the global/project separation
described in [navigation.md](./navigation.md).

A nav contribution carries the route it links to
(`packages/modules-sdk/src/slots.ts`):

```ts
export const NAV_SLOT_SCOPE: Readonly<Record<string, NavScope>> = {
	[SLOTS.globalNav]: "global",
	[SLOTS.projectNav]: "project",
};

export interface NavExtensionPoint extends ExtensionPoint {
	slot: typeof SLOTS.globalNav | typeof SLOTS.projectNav;
	/** Route pattern the nav entry links to, e.g. "/projects/:projectId/board". */
	route: string;
	label: string;
}
```

On registration, `ModuleRegistry.register(manifest)` validates **before recording
anything** (so registration is atomic): for every nav contribution it looks up the
slot's required scope in `NAV_SLOT_SCOPE` and calls
`assertNavScope(point.route, required)` from `@tundra/domain`. A mismatch throws
and the whole `register` call fails. The registry also rejects duplicate module
ids.

This means a module **cannot** sneak a global link into project navigation or a
project link into global navigation — the violation is rejected at registration
time, not discovered later at render time. The same `assertNavScope` function
guards the core nav lists, so core and module contributions obey one rule.
