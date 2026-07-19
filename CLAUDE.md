# Tundra

**Product name:** Tundra
**Product type:** Source-available (free to self-host), modular project-management and collaboration platform. Licensed under the Elastic License 2.0.

Tundra is an independent product inspired by agile tools but designed to stand
on its own. It emphasizes modularity, extensibility, a unified work-item model,
project-scoped navigation, and a polished mint/orange brand direction.

These instructions apply to every Claude Code session in this repository.

---

## Main principles

- **Modular by default.** Functionality is delivered as modules; the core stays small.
- **Extensible through modules and extension points.** Features plug in rather than
  being hard-wired into the core.
- **Unified work item model.** Tasks, user-story checklist items, bugs, reviews,
  docs follow-ups, and extension-generated actions are all expressed as one
  coherent `WorkItem` concept.
- **My Tasks aggregates assigned work** from tasks, user-story checklist items,
  bugs, reviews, docs follow-ups, and extension-generated actions into a single
  unified view.
- **Project top navigation is always project-scoped.** When inside a project, the
  top navigation reflects that project's context.
- **Global navigation and project navigation must stay separate.** Never blend
  global concerns into project-scoped menus or vice versa.
- **Frontend preserves the mint-dominant brand with orange accents.**
- **TypeScript-first implementation** across the entire stack.
- **Strong accessibility and semantic HTML.** Accessibility is a requirement, not
  a nice-to-have.
- **No hidden vendor lock-in.** Avoid proprietary dependencies that trap users.

---

## Engineering principles

- Small, reviewable changes.
- No secrets in the repo.
- No external deployment without explicit confirmation.
- No pushing to remote unless explicitly requested.
- Always update docs when changing architecture or public APIs.
- Prefer explicit architecture decisions in `docs/adr`.
- Run lint, typecheck, tests, and build before declaring work complete.

---

## Planned monorepo direction

```
apps/
  web/                # frontend application
  api/                # GraphQL API service
  worker/             # background job processing
packages/
  ui/                 # shared UI component library and design system
  domain/             # unified work-item model and domain logic
  db/                 # database schema, migrations, data access
  modules-sdk/        # SDK for building Tundra modules and extension points
  config/             # shared configuration loading and validation
  test-utils/         # shared testing helpers and fixtures
docs/                 # architecture, ADRs, product, deployment docs
infra/                # local infrastructure and deployment config
```

---

## Expected local stack

- TypeScript
- pnpm workspaces
- PostgreSQL
- Redis
- GraphQL API
- Lightweight, semantic frontend
- Docker Compose for local development

---

## Specialized subagents

Six reusable, generic subagents handle specialized work. See
`docs/agent-workflow.md` for how they fit into the overall workflow. Tundra-specific
context (the unified WorkItem model, mint/orange brand, project-scoped navigation,
etc.) lives here in CLAUDE.md and in `docs/`, not inside the agent definitions.

- `architect` — architecture, domain modeling, module boundaries, ADRs.
- `product-designer` — frontend architecture, design system, accessibility, brand.
- `implementation-engineer` — implementation and integration in strict TypeScript.
- `qa-engineer` — test strategy, quality gates, CI checks.
- `technical-writer` — README, developer docs, ADRs, release notes.
- `deployment-engineer` — Docker, Docker Compose, CI/CD, local infrastructure.
