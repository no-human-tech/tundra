# Agent Workflow

This document explains how AI assistance is organized while building Tundra.

## Roles

### Claude Code — implementation executor

Claude Code is the implementation executor for Tundra. It performs the actual
work in the repository: scaffolding, writing code, editing files, running checks,
and producing documentation. Claude Code works in **small iterations** so that
each step is easy to review and reason about.

### Six specialized subagents

Claude Code delegates focused work to six **generic, reusable** subagents, each
with a narrow responsibility. The agents are intentionally project-agnostic;
Tundra-specific context (the unified WorkItem model, the mint/orange brand,
project-scoped navigation, extension points, etc.) lives in `CLAUDE.md` and the
`docs/` tree, not inside the agent definitions.

- **architect** — architecture decisions, domain modeling, module boundaries,
  API contracts, the data model, ADRs, and long-term technical direction.
- **product-designer** — frontend architecture, the design system, UI components,
  accessibility, layout, and brand consistency.
- **implementation-engineer** — implementation, scaffolding, TypeScript code,
  frontend and backend packages, scripts, and integration work.
- **qa-engineer** — test strategy, unit/integration/e2e smoke tests, CI quality
  gates, fixtures, and regression risk analysis.
- **technical-writer** — README, developer documentation, architecture docs,
  ADRs, contribution guide, API docs, and release notes.
- **deployment-engineer** — Docker, Docker Compose, CI/CD, environment variables,
  the deployment plan, observability, and local infrastructure.

These generic agents are defined at the project level in `.claude/agents/`. If
equivalent reusable agents are made available through user-level Claude Code
configuration (`~/.claude/agents/`), the repository is happy to use those instead
— the names are deliberately generic so they resolve from either location without
duplication.

### Codex — external supervisor and reviewer

Codex acts as the external supervisor and reviewer. Codex does not implement;
it reviews the output of each Claude Code iteration.

## How iterations flow

1. Claude Code implements a small, self-contained iteration.
2. Codex reviews that iteration.
3. Only after Codex's review does work proceed to the next, larger step.

This keeps changes small, reviewable, and continuously supervised.

## Guardrails

- **No remote push** happens without explicit human approval.
- **No external deployment** happens without explicit human approval.
- Secrets never enter the repository.
- Documentation is updated whenever architecture or public APIs change.
