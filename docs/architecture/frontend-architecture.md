# Frontend Architecture

Tundra's frontend is built on **React 18** as the MVP core. This document
captures the deliberate constraints that keep the frontend maintainable and
the bundle lean.

---

## React as the MVP core

React stays as the rendering layer. The choice is locked in for the MVP:
replacing it would require rewriting every component with no functional gain
at this stage. Revisit only when there is a concrete, justified need.

---

## No heavy component framework

**No UI mega-libraries (MUI, Chakra, Radix-UI, Ant Design, etc.) are added.**
Every component is either:

- A primitive from `@tundra/ui` (the project's own design-system package), or
- Inline semantic HTML + CSS custom properties.

Rationale: third-party component libraries bundle opinionated styles and large
JS runtimes. Tundra's brand (mint/orange tokens) and accessibility bar are
easier to own when the component surface is minimal.

---

## `@tundra/ui` — presentation only, no business logic

`packages/ui` exports only presentational primitives: `Button`, `Badge`,
`Logo`, `Icon`, `Skeleton`, `StatusDot`, etc. Rules:

- **No data fetching** inside `@tundra/ui`.
- **No GraphQL / API calls** inside `@tundra/ui`.
- **No routing logic** inside `@tundra/ui`.
- **No business domain knowledge** (WorkItem shapes, auth state, etc.).
- Props are plain data. Events are callbacks.

When a component needs domain data, it belongs in the consuming app
(`apps/web`), not in `@tundra/ui`.

---

## When to create a component vs. inline HTML + CSS

Create a component in `@tundra/ui` when:

- The element is reused in **3+ places** across unrelated screens.
- It has meaningful **accessible state** that must be consistent (e.g. a
  `Toggle`, a `StatusDot` with ARIA live regions).
- It encapsulates a **non-trivial visual variant set** (e.g. `Badge` with
  `variant` prop).

Prefer inline semantic HTML + CSS when:

- It appears **once or twice**, closely tied to a specific screen.
- There is no shared state or interactive behaviour.
- Extracting it would create a component that receives all its content as
  props and adds no real abstraction.

> Three similar lines of HTML is better than a premature component abstraction.

---

## Code splitting — `React.lazy` / `Suspense` for heavy routes

Heavy routes that are not needed on first paint are code-split using
`React.lazy` and `React.Suspense`. The pattern used in `apps/web/src/App.tsx`:

```tsx
const MyTasksPage = lazy(() =>
	import("./pages/MyTasksPage.js").then((m) => ({ default: m.MyTasksPage })),
);

// In the route tree:
<Suspense fallback={<span aria-live="polite" />}>
	<Route path="/my-tasks" element={<MyTasksPage />} />
</Suspense>;
```

Criteria for lazy-loading a route:

- The page module is **larger than ~20 kB** gzipped (visible in bundle report).
- It is **not on the critical first-paint path** (i.e. not `/dashboard` or `/login`).
- Adding a dynamic import does not break an existing E2E or invariant test.

The Suspense fallback is intentionally invisible (`aria-live="polite"` with no
visible content) because the dev server loads instantly. Add a visible spinner
only when measured P50 load times warrant it.

---

## Bundle analysis

Run after every significant dependency or page addition:

```bash
# Build and print the asset size report:
corepack pnpm --filter @tundra/web run build

# Detailed per-chunk report:
corepack pnpm --filter @tundra/web run analyze
```

`pnpm analyze` builds and then runs `scripts/bundle-report.mjs`, which prints
all JS/CSS chunks sorted by size. Use it to:

- Detect unexpectedly large chunks (> 50 kB gzipped in a single lazy chunk).
- Verify that lazy splits produce separate files, not one monolithic bundle.
- Catch new heavy dependencies before they land on `main`.

There is no enforced size budget gate today — the goal is visibility. A budget
can be added to `vite.config.ts` via `build.chunkSizeWarningLimit` when
thresholds are agreed.

---

## Removing dead components

Before every release:

1. Search for components in `packages/ui/src/primitives/` and `apps/web/src/`
   that have **zero imports** in the rest of the codebase:
   ```bash
   # Example: find unreferenced primitives
   grep -r "import.*from.*@tundra/ui" apps/web/src --include="*.tsx" | \
     grep -oP "(?<=\{ ).*?(?= \})" | tr ',' '\n' | sort | uniq
   ```
2. Remove confirmed dead exports to keep the bundle lean.
3. Run `pnpm run typecheck` to confirm no references remain.

Dead-component removal is not automated yet — it is a manual pre-release step.
Automation can be added via `ts-prune` or `knip` when the codebase stabilises.
