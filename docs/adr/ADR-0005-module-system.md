# ADR-0005: Module system and extension points

- **Status:** Accepted
- **Date:** 2026-06-27

## Context

Tundra's defining principle is "modular by default": the core stays small and
features plug in rather than being hard-wired. We need a way for modules to
contribute navigation entries, dashboard widgets, work-item drawer panels, and
settings panels on the frontend, and to feed work items and authorize actions on
the backend — without granting modules raw access to the database or letting them
violate core invariants such as navigation separation. We also want bugs, reviews,
and documentation follow-ups to be modules that produce WorkItems rather than core
tables, so the core does not grow a special case for every kind of work.

## Decision

Adopt a **manifest-driven module system** with a **closed initial set of named
extension-point slots**, defined in `@tundra/modules-sdk` (which depends only on
`@tundra/domain`). A `ModuleManifest` declares what a module contributes
(`contributes: ExtensionPoint[]`), its coarse `permissions`, and any
`providesWorkItemSources`. The `ModuleRegistry` is the authoritative index: it
rejects duplicate module ids, validates nav contributions against their slot's
required scope (`assertNavScope`) **atomically before recording**, indexes
contributions by slot, and tracks `WorkItemProvider`s for the worker to discover.
The slots are `global.nav`, `project.nav`, `dashboard.widgets`, `workitem.drawer`,
`project.settings`, `workspace.settings` (frontend) and `workitem.providers`,
`permission.hooks` (backend). Backend modules receive a read-only `ProviderContext`
— never a raw db handle. `WorkItemProvider`s feed the unified read model;
`PermissionHook`s are composed with **AND** (any `false` denies).

## Consequences

- The core stays small: bugs, reviews, and docs follow-ups ship as modules that
  provide WorkItems, and future integrations (GitHub, Discourse) use the same seam.
- Modules cannot bypass core invariants — nav scope is validated at registration,
  and modules never get direct database access.
- The initial slot set is intentionally closed; adding a new extension-point kind
  is a deliberate, reviewed change rather than an open-ended plugin surface.
- Permission composition with AND is conservative (safe by default) but means a
  single denying hook can block an action; this is the intended fail-closed
  behaviour.
- Modules are first-party and trusted for now; runtime sandboxing of untrusted
  third-party modules is deferred.
