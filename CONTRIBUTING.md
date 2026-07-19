# Contributing to Tundra

Thanks for your interest in contributing. Tundra is an early source-available
foundation (Elastic License 2.0), so the most valuable contributions right now keep changes small,
well-scoped, and easy to review. This guide explains how to set up your
environment, the workflow we follow, and the guardrails everyone is expected to
respect.

By participating you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## Prerequisites

- **Node.js >= 20.11** — Tundra targets Node 20 LTS or newer.
- **corepack** — ships with Node; it activates the pinned **pnpm** version.
- **Docker** — for the local PostgreSQL and Redis services.

Tundra is a **pnpm workspaces + Turborepo** monorepo. The pnpm version is pinned
in the root `package.json`, so always invoke it through corepack as
`corepack pnpm …` to use the exact version the project expects.

## Setup

```bash
corepack enable          # activate the pinned pnpm version
corepack pnpm install    # install all workspace dependencies
cp .env.example .env     # create your local environment file (never commit .env)
```

See [`docs/development/getting-started.md`](docs/development/getting-started.md)
for the full local workflow (Docker Compose, running individual apps, environment
variables), and
[`docs/development/repository-structure.md`](docs/development/repository-structure.md)
for how the monorepo is organized.

## Small, reviewable changes

Tundra favors **small, self-contained changes**. Each pull request should do one
thing and be easy to reason about in a single review. If a change is large, split
it into a sequence of smaller PRs. This keeps history clear and review fast, and
it is a core engineering principle of the project.

When you change architecture or a public API, **update the relevant docs in the
same change**. Documentation that drifts from the code is treated as a bug.

## Branch and PR flow

1. Fork the repository (or create a branch if you have write access). Work on a
   topic branch, never directly on the default branch.
2. Make your change, keeping it small and focused.
3. Run the quality checks locally (see below).
4. Open a pull request against the default branch with a clear description of
   what changed and why. Link any related issue.
5. A maintainer (and, in this project, the Codex supervisor — see below) reviews
   the change before it proceeds.

## Run checks before pushing

Before you push, run the quality gates from the repository root:

```bash
corepack pnpm lint        # ESLint
corepack pnpm typecheck   # TypeScript
corepack pnpm test        # Vitest
corepack pnpm build       # build all apps and packages
```

You can run the same combined gate that CI runs:

```bash
corepack pnpm ci          # lint + typecheck + test + build
```

Formatting is handled by Prettier:

```bash
corepack pnpm format        # write formatting fixes
corepack pnpm format:check  # verify formatting (used in CI)
```

## Commit style

- Write clear, imperative commit subjects (e.g. "Add WorkItemProvider contract",
  not "added" or "adding").
- Keep the subject line concise; use the body to explain the _why_ when it is not
  obvious.
- Group related work into logical commits; avoid bundling unrelated changes.
- Reference issues where relevant (e.g. `Fixes #123`).

## Architecture Decision Records (ADRs)

Significant or hard-to-reverse technical decisions are recorded as ADRs in
[`docs/adr/`](docs/adr/), using the standard **Context / Decision / Consequences**
form. Write a new ADR when you:

- choose or replace a foundational technology or pattern,
- change a module boundary or a public contract,
- introduce a cross-cutting rule that future contributors must follow, or
- make a decision you would otherwise have to re-explain in code review.

Prefer recording the decision in an ADR over leaving the reasoning only in a PR
thread. Smaller, reversible choices do not need an ADR.

## The specialized subagents

Tundra's AI-assisted workflow uses six generic, reusable subagents, each with a
narrow responsibility:

- **architect** — architecture, domain modeling, module boundaries, ADRs.
- **product-designer** — frontend architecture, design system, accessibility,
  brand.
- **implementation-engineer** — implementation and integration in strict
  TypeScript.
- **qa-engineer** — test strategy, quality gates, CI checks.
- **technical-writer** — README, developer docs, ADRs, release notes.
- **deployment-engineer** — Docker, Docker Compose, CI/CD, local infrastructure.

How these roles fit into the overall iteration flow is described in
[`docs/agent-workflow.md`](docs/agent-workflow.md). Tundra-specific context lives
in `CLAUDE.md` and the `docs/` tree, not inside the agent definitions.

> **Codex supervision.** `AGENTS.md` governs Codex supervision: Codex acts as the
> external reviewer of each iteration and does not implement. It reviews the
> output of each small change before work proceeds to the next step.

## Guardrails

These rules are non-negotiable:

- **No secrets in the repository.** Never commit credentials, tokens, or a real
  `.env`. Use `.env` (git-ignored) locally and keep `.env.example` as the
  documented template.
- **No pushing to a remote without explicit approval.** Do not push branches or
  changes to a shared remote unless a human has explicitly requested it.
- **No external deployment without explicit approval.** Deploying anywhere
  outside your local machine requires explicit human confirmation.
- **Keep global and project navigation separate.** Never blend global concerns
  into project-scoped menus or vice versa.
- **Update docs when architecture or public APIs change.**

If you are unsure whether something is allowed, ask before acting.
