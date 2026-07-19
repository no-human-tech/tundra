# ADR-0004: Project-scoped navigation

- **Status:** Accepted
- **Date:** 2026-06-27

## Context

Tundra has two clearly different navigation contexts: a global, workspace-level
shell (Dashboard, Projects, My Tasks, Time, Reports, Extensions, Workspace
Settings) and a project context that must always be scoped to the project you are
in (Overview, Backlog, Board, Sprints, Time, Docs, Discussions, Reports,
Settings). If these blend — a project menu linking to a global area, or a global
menu linking into a specific project — the product becomes confusing and the
mental model breaks. Because modules can also contribute navigation entries, the
separation must be enforceable against untrusted contributions, not merely
followed by convention in the core.

## Decision

Define **two disjoint route namespaces** as constants in `@tundra/domain`:
`GLOBAL_ROUTES` and `PROJECT_ROUTE_PATTERNS` (project routes all begin with
`/projects/:projectId/`). A route's scope is determined purely by its shape via
`navScopeOf`, and `assertNavScope(route, declared)` throws on any mismatch. The web
shell renders exactly two nav components, fed by `GLOBAL_NAV` and `PROJECT_NAV`,
both derived from those constants so the menus cannot drift from the routes. Module
nav contributions target either the `global.nav` or `project.nav` slot and are
validated with `assertNavScope` at **registration time** — a scope violation is
rejected before anything is recorded. There is no third, blended menu.

## Consequences

- Global and project navigation can never mix, for both core and module-contributed
  entries, because everything routes through one `navScopeOf` / `assertNavScope`
  pair.
- A misbehaving module that tries to add a global link to project nav (or vice
  versa) fails loudly at registration, not silently at render.
- Menus stay in sync with route definitions by construction.
- **Navigation separation** becomes a CI-gated invariant.
- A genuinely cross-context link (rare) must be expressed deliberately within the
  correct namespace; the rule does not allow ad-hoc blending. This is the intended
  constraint.
