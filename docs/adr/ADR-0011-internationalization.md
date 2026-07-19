# ADR-0011: Internationalization of the web app

- **Status:** Accepted
- **Date:** 2026-06-28

## Context

Tundra's web app shipped English-only, with user-visible strings hardcoded across
screens and inside the shared `@tundra/ui` components. To serve a broad
open-source audience we need the app translated into multiple languages, including
CJK, without compromising the project's structural invariants:

- `@tundra/domain` must stay **pure and dependency-free** — it owns the canonical
  work-item enums and the navigation order/keys/routes, and must hold no UI text.
- `@tundra/ui` must stay **reusable and i18n-library-free** so it is not coupled to
  one app's translation choices.
- The API must keep returning **stable machine codes**, not localized prose, so the
  contract and the stored audit trail stay language-neutral.
- The global/project navigation separation and the unified-`WorkItem`
  source-as-metadata invariants must survive translation.
- A missing or late translation must **never break the UI**.

We also need type safety (a misspelled translation key should fail the build, not
the runtime), language detection and persistence, an accessible language picker,
and CJK rendering without bloating the bundle with multi-megabyte fonts.

## Decision

Internationalize the web app with **`i18next` + `react-i18next` +
`i18next-browser-languagedetector`**, confined to `apps/web`, and inject all
translated text into the shared packages through narrow boundaries.

- **Library.** i18next is mature and well-maintained, with built-in fallback,
  browser detection, interpolation/plurals, and — via a type augmentation —
  type-checked keys. react-i18next gives the hook-based API and the `<Trans>`
  component for inline markup. The detector handles detection/persistence.

- **Locales.** Nine languages — `en` (default/fallback), `pl`, `es`, `de`, `fr`,
  `it`, `zh`, `ko`, `ja` — under a single `translation` namespace, one JSON file
  per locale in `apps/web/src/i18n/locales`. **`en.json` is the authoritative
  master** (471 leaf keys); every other locale has exact key parity, enforced by
  `apps/web/scripts/check-locales.mjs` and by a per-locale Vitest case.

- **Init and fallback.** All locales are **bundled** (no HTTP backend) and init is
  **synchronous** (`initImmediate: false`, `react.useSuspense: false`), so the
  first render has strings and no network failure can break the UI.
  `fallbackLng: "en"` with `returnNull: false` / `returnEmptyString: false` makes
  a missing key resolve to English. `load: "languageOnly"` collapses regional
  codes.

- **Detection, selection, persistence.** The detector reads `localStorage` then
  `navigator`, caching to `localStorage["tundra.lang"]`. An accessible
  `LanguageSwitcher` (`<select>` of autonyms) in the Topbar drives
  `i18n.changeLanguage` and updates `<html lang>`. The storage seam is built so the
  preference can later move to the user profile.

- **Typed keys.** `i18next.d.ts` augments `CustomTypeOptions.resources` against
  `typeof en`, so every `t("…")` is checked against the master and an unknown key
  is a TypeScript error.

- **Domain/UI boundary.** `@tundra/domain` is untouched. `@tundra/ui` components
  expose **optional override props defaulting to the current English string**
  (resolver functions where text derives from a domain enum, e.g. the
  `WorkItemLabels` object on `WorkItemList`/`WorkItemRow`). The app injects
  translations through these props, preserving source-as-metadata and nav
  separation.

- **API code boundary.** The API returns stable codes; `apps/web/src/i18n/codes.ts`
  maps `RevertResult.reason` and `AuditEvent.action` codes to translated messages
  at the presentation boundary only, with `unknown` fallbacks. Stored audit data is
  never localized.

- **Fonts/layout.** No CJK webfonts are bundled; the shared font tokens append an
  OS CJK fallback stack. Layout grows/wraps for longer strings rather than clipping.

- **Tooling/tests.** `i18n:check` validates parity and JSON; Vitest covers
  switching, fallback, parity, translated nav, and My Tasks in pl/ja; a Playwright
  e2e asserts switch + persistence.

## Consequences

- The app is available in nine languages with a single, type-safe key set;
  misspelled keys fail the build, and missing translations degrade to English
  rather than breaking.
- `@tundra/domain` and `@tundra/ui` stay clean and reusable — the i18n dependency
  never enters the shared packages, and `@tundra/ui` remains usable by any
  consumer with English defaults.
- Every new user-visible string in `@tundra/ui` now needs an override prop, and
  every new `en.json` key must be mirrored to all eight other locales (and added to
  the autonym list when adding a language). Parity is gated by `i18n:check` and
  tests, so drift fails fast.
- Bundling all locales keeps the runtime resilient and synchronous at the cost of a
  modest bundle increase; this is acceptable for a chrome-only string set and avoids
  a network dependency for correctness. Per-locale code-splitting can be revisited
  if the string set grows substantially.
- CJK rendering relies on OS fonts; users without a CJK font installed may see
  fallback glyphs, which is an accepted trade against multi-megabyte webfonts.
- The shipped non-English translations are initial and AI-assisted; native-speaker
  review is an explicit follow-up. The language preference lives in localStorage and
  is expected to move to the user profile once profiles exist.

## Alternatives considered

- **react-intl / FormatJS.** Rejected: powerful ICU message support, but a heavier
  authoring model (message extraction/compilation) than needed for a nested-key set,
  and weaker out-of-the-box detection/persistence than the i18next detector.
- **Lingui.** Rejected: ergonomic macro-based extraction, but adds a compile-time
  macro/build step and a smaller ecosystem; i18next's runtime model fit the bundled,
  synchronous, type-augmented approach better.
- **A hand-rolled solution.** Rejected: we would reimplement fallback, detection,
  interpolation, plurals, and persistence — the exact, well-tested surface i18next
  already provides — for no benefit.
- **Putting strings in `@tundra/domain` / `@tundra/ui`.** Rejected: it would couple
  the shared packages to one app's i18n and violate the domain-purity and
  UI-reusability invariants. Optional override props keep both clean.
- **Localizing API responses.** Rejected: it would bake a language into the
  contract and the audit trail. Stable codes mapped at the UI boundary keep the
  backend language-neutral.
