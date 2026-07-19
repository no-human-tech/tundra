# Code style & lint policy

How Tundra formats and lints code, and the explicit decisions behind it. Tooling
is configured at the repo root (`.prettierrc.json`, `.editorconfig`,
`eslint.config.js`) and runs in CI via `corepack pnpm run lint` and
`corepack pnpm run format:check`.

## Indentation: tabs

**Decision: the project standard is tab indentation.** This is set explicitly —
`.prettierrc.json` has `"useTabs": true` (`"tabWidth": 2` remains for alignment
contexts) and `.editorconfig` declares `indent_style = tab`. The two configs are
kept in agreement on purpose, so editors and Prettier never disagree.

Rationale: tabs are the accessibility-friendly choice — they let each contributor
set their preferred display width in their editor without committing visual
preferences to the source file. Using tabs is a deliberate, inclusive decision
rather than a default. Run `corepack pnpm run format` after any config change to
keep the whole codebase consistent.

## Prettier

Canonical formatter for `.ts/.tsx/.js/.jsx/.json/.css/.md/.yml/.yaml`. Config:
semicolons, double quotes, trailing commas (`all`), `printWidth: 100`,
`tabWidth: 2`, `useTabs: true`, `arrowParens: always`, `endOfLine: lf`.

- `corepack pnpm run format` — write.
- `corepack pnpm run format:check` — verify (CI-gated; must be clean).

## ESLint

Flat config (`eslint.config.js`), ESLint 9 + typescript-eslint, run as
`eslint .`. It is intentionally syntactic (no type-aware project) to stay fast.
`eslint .` fails the build on **errors only**; warnings are advisory.

### Module boundary enforcement (errors)

Real, dependency-free enforcement via the built-in `no-restricted-imports`
(disjoint file globs so each file gets exactly one rule set):

- `packages/domain/**` may not import any `@tundra/*` (it is dependency-free).
- `apps/web/**` and `packages/ui/**` may not import `@tundra/db` (reach
  persistence through the API).
- `packages/{config,modules-sdk,db,test-utils}/**` may not import apps
  (`@tundra/api`/`@tundra/web`/`@tundra/worker`).

These fire as errors; violations break CI.

### JSDoc policy (public API packages)

`eslint-plugin-jsdoc` is enabled for the **public-contract packages**
(`packages/domain`, `packages/modules-sdk`), TypeScript mode:

- **Correctness rules are errors** (`check-alignment`, `check-param-names`,
  `check-property-names`, `empty-tags`, `no-multi-asterisks`). They no-op when a
  symbol has no JSDoc, so they enforce _quality of what is written_ without
  forcing presence everywhere. Type tags are **not** required — TypeScript already
  provides types.
- **Presence is a warning** (`require-jsdoc` on exported functions, interfaces,
  type aliases, enums; `publicOnly`). This surfaces undocumented public API as
  guidance. **New exported public API should ship with JSDoc** (and therefore not
  add warnings); the existing backlog of warnings is the ratchet target.

**Status:** JSDoc presence is _linted at warn_, not yet enforced as an error.
We do not claim full JSDoc compliance — the rule exists and is the path to it. The
plan is to drive the warning count to zero on `packages/domain` and
`packages/modules-sdk`, then promote `require-jsdoc` to `error` for those
packages.

## TypeScript

Strict everywhere (`tsconfig.base.json`): `strict`, `noUncheckedIndexedAccess`,
`isolatedModules`, `moduleResolution: Bundler`. `corepack pnpm run typecheck`
(`tsc --noEmit` per package) is CI-gated.
