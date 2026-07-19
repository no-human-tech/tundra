# Tundra Product Vision

Tundra is a **source-available, modular project-management and collaboration
platform**. It is inspired by agile tools but designed to stand on its own,
with a deliberately **small core** and most capability delivered as **modules**.
Tundra's defining idea is a **unified work item model**: everything a person is
expected to act on — across many feature areas — is expressed as one coherent
`WorkItem`, and surfaced in one place.

This document describes who Tundra is for, what it offers, and the principles
that keep it coherent as it grows.

## Who Tundra is for

- **Teams running agile and modular project work.** Groups who plan, track, and
  collaborate across projects and want a single, calm tool that adapts to how
  they work rather than forcing one rigid process.
- **Module and extension authors.** Developers who extend Tundra by building
  modules that plug into defined extension points — adding navigation, dashboard
  widgets, settings panels, and new sources of work — without forking the core.
- **Workspace administrators.** People who configure a workspace, decide which
  modules are enabled at the workspace and project level, and manage projects,
  membership, and roles.

## Core modules

Functionality ships as modules so the core stays small. The intended core module
set includes:

- **Projects** — the primary container for work; every project belongs to a
  workspace and carries its own scoped navigation and settings.
- **Tasks** — the everyday unit of work, with status, priority, assignee, and
  optional subtasks.
- **User stories and checklists** — narrative stories with checklist items that
  can be individually assigned and tracked.
- **Sprints, backlog, and board** — agile planning surfaces for organizing and
  visualizing work over time.
- **Time tracking** — recording effort against work items, available both
  per-project and across the workspace.
- **Docs / wiki** — project documentation with a page tree.
- **Discussions** — threaded conversation attached to a project.
- **Reports** — rollups such as velocity, burndown, throughput, and time
  summaries.
- **Module registry / extensions** — the registry of installed modules and the
  extension points they contribute to.

Some sources of work — bugs, reviews, and documentation follow-ups — are
delivered as modules that **provide work items** rather than as hard-wired core
tables. This keeps the core small while letting that work flow into the same
unified queue (see below).

## "My Tasks": one unified work queue

"My Tasks" is the heart of Tundra's day-to-day value. Instead of forcing people
to check many separate lists, Tundra **aggregates everything assigned to you into
a single view**, drawn from every source:

- tasks and subtasks,
- user-story checklist items,
- bugs,
- reviews,
- documentation follow-ups, and
- automation-generated and extension-generated actions.

This is possible because every assignable thing is materialized into one
**unified `WorkItem` model**. A `WorkItem` carries a `source` discriminator and a
stable back-reference (`sourceRef`) to the entity it came from, plus the common
fields people act on: title, status, priority, assignee, due date, and project.
"My Tasks" is then a **single query** over the work-item read model, filtered by
assignee and active status — it never has to fan out across many source tables.

The crucial design rule: **source is metadata, never a different layout.** Every
work item, whatever its origin, renders in the same row format. A small
source/module badge tells you where an item came from (a task, a bug, a review, a
docs follow-up, an automation, or a specific extension), but the layout and
interactions are identical. This keeps the queue dense, scannable, and
predictable, and it prevents per-source UI drift as new modules add new sources.

## Project-scoped navigation

Navigation in Tundra is split into two strictly separate contexts:

- **Global navigation** is always present and reflects workspace-wide concerns
  (such as the dashboard, the list of projects, My Tasks, time, reports, and
  extensions). It never links into a specific project's internals.
- **Project navigation** appears only when you are inside a project and is always
  **scoped to that project's context** (overview, backlog, board, sprints, time,
  docs, discussions, reports, settings).

**Global and project navigation must never blend.** Global concerns do not leak
into project menus, and project-scoped entries do not leak into global menus.
This separation matters because it keeps the user's sense of place unambiguous —
you always know whether you are acting at the workspace level or within a single
project — and it gives modules a clear, validated contract: a module contributes
to either the global or the project navigation scope, never both at once.

## Modular extension philosophy

Tundra is **modular by default and extensible through extension points.** The
philosophy is:

- **Keep the core small.** Features are modules, not core hard-wiring. The core
  provides the unified work-item model, the navigation contract, and the host
  that loads modules.
- **Extend through declared extension points.** Modules contribute to a defined,
  named set of slots — navigation entries, dashboard widgets, work-item drawer
  panels, and settings panels on the frontend; permission hooks and work-item
  providers on the backend. A module declares what it contributes up front, so
  the host always knows a module's surface and the permissions it needs.
- **Feed the unified queue through providers.** A **WorkItemProvider** is how a
  module contributes new sources of work (bugs, reviews, docs follow-ups,
  automation, third-party integrations) into the unified work-item model without
  the core needing to know those source types intrinsically. The provider's
  items obey the same work-item contract, so they appear in My Tasks alongside
  everything else.

The result is a platform that grows by adding modules, not by bloating the core —
and one with **no hidden vendor lock-in**, avoiding proprietary dependencies that
would trap users.

## Brand and experience direction

Tundra's visual direction is **mint-dominant with restrained orange accents**:

- **Mint** is the dominant surface and identity color — calm, professional, and
  distinct from the tools Tundra is inspired by.
- **Orange** is a restrained accent, reserved for primary actions and for the
  "automation/extension energy" — never used as a large fill.

The experience aims to be **calm and accessible**. Accessibility is a baseline
requirement: semantic HTML, clear landmarks, keyboard operability, visible focus,
WCAG-conscious color contrast, and meaning that never relies on color alone.
Tundra should feel quiet and dependable, so people can focus on their work rather
than on the tool.
