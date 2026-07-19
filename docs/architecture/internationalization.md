# Internationalization (i18n)

Tundra's web app ships fully translated into **nine languages**. The translation
layer lives entirely in `apps/web`; the shared domain and UI packages stay
i18n-library-free and receive translated text through well-defined boundaries.
This keeps `@tundra/domain` pure, keeps `@tundra/ui` reusable, and keeps the API
returning stable machine codes rather than localized prose.

This document describes the architecture. For day-to-day tasks — adding a key,
adding a language, running the checks — see the developer guide,
[`docs/development/localization.md`](../development/localization.md). The decision
and its rationale are recorded in
[ADR-0011](../adr/ADR-0011-internationalization.md).

---

## Supported locales

One `translation` namespace, nine locales. `en` is the **default and fallback**;
`en.json` is the authoritative master key set.

| Code | Language | Autonym  | Role             |
| ---- | -------- | -------- | ---------------- |
| `en` | English  | English  | default/fallback |
| `pl` | Polish   | Polski   |                  |
| `es` | Spanish  | Español  |                  |
| `de` | German   | Deutsch  |                  |
| `fr` | French   | Français |                  |
| `it` | Italian  | Italiano |                  |
| `zh` | Chinese  | 中文     |                  |
| `ko` | Korean   | 한국어   |                  |
| `ja` | Japanese | 日本語   |                  |

Every non-English locale has **exact key parity** with `en` — no missing and no
extra keys. Parity is enforced both by a standalone check script
(`apps/web/scripts/check-locales.mjs`) and by a Vitest case per locale, so a key
can never silently drift out of sync.

---

## Library choice

The web app uses **`i18next` + `react-i18next` + `i18next-browser-languagedetector`**,
added in `apps/web` only. The rationale (and the alternatives weighed against it)
is in [ADR-0011](../adr/ADR-0011-internationalization.md); in short, i18next is a
mature, well-maintained stack with built-in fallback, browser detection,
interpolation/plurals, and — via a small type augmentation — type-checked
translation keys, without pulling a heavy or lock-in-prone dependency into the
shared packages.

---

## Resource layout and namespace

- Locale files live at `apps/web/src/i18n/locales/<code>.json`, one file per
  locale, all under a single `translation` namespace with nested keys.
- `en.json` is the **master**: it defines the canonical key set (471 leaf keys at
  time of writing). Every other locale mirrors that exact set.
- Keys are grouped by surface — `common.*`, `nav.global.*` / `nav.project.*`,
  `shell.*`, `workItem.*`, `myTasks.*`, the per-screen groups
  (`dashboard.*`, `projects.*`, `project.<screen>.*`, `extensions.*`,
  `taskDrawer.*`, …), the `language.*` switcher labels, and the
  `audit.revert.reason.*` / `audit.action.*` code-mapping groups.
- Interpolation (`{{count}}`, `{{name}}`, `{{project}}`, …) is used throughout.
  Where inline markup is needed (e.g. a bold span inside a sentence), the app uses
  react-i18next's `<Trans>` component rather than concatenating strings.

---

## Initialization and fallback behavior

i18next is initialized in `apps/web/src/i18n/index.ts` and imported by
`apps/web/src/main.tsx` **before** the app renders. Key properties:

- **All nine locales are bundled** (imported as JSON, not loaded over HTTP).
  There is no backend plugin, so a slow or failed network request can never leave
  the UI without strings, and the very first render already has its translations.
- **Synchronous init** (`initImmediate: false`) plus **`react.useSuspense: false`**
  means components render synchronously with no Suspense boundary — this also keeps
  tests and SSR-style renders deterministic.
- **`fallbackLng: "en"`** with **`returnNull: false`** and
  **`returnEmptyString: false`**: a key missing from any locale resolves to the
  English master rather than to `null`, `""`, or a raw key. A missing translation
  degrades to English; it never breaks the UI.
- **`load: "languageOnly"`** with **`nonExplicitSupportedLngs: true`** collapses
  regional codes (e.g. `en-GB` → `en`) onto the supported base languages.

The supported-language list and the localStorage key are exported from the init
module as `SUPPORTED_LANGUAGES` and `LANGUAGE_STORAGE_KEY`.

---

## Detection, selection, and persistence

- **Detection** uses `i18next-browser-languagedetector` with order
  `["localStorage", "navigator"]`: an explicit stored choice wins, otherwise the
  browser language is used, otherwise English. Anything unsupported falls back to
  English.
- **Persistence** caches the choice to `localStorage` under the stable key
  `tundra.lang` (`LANGUAGE_STORAGE_KEY`), so the preference survives reloads.
- **Selection** is the accessible `LanguageSwitcher` in the Topbar
  (`apps/web/src/components/LanguageSwitcher.tsx`): a labelled native `<select>`
  listing all nine languages by **autonym** (each language's own name, identical
  across all locale files). Changing it calls `i18n.changeLanguage`, which both
  persists the choice and updates the active language app-wide.
- `<html lang>` is set from `i18n.resolvedLanguage` on startup and updated on
  every language change, so assistive technology and the lang-aware CSS font stack
  pick up the switch immediately.

> **Future direction.** The persisted preference lives in localStorage today. The
> switcher and storage seam are designed so this can move to the signed-in user's
> profile once user profiles exist, with localStorage remaining the
> anonymous/pre-auth fallback. No call site outside the i18n layer needs to change.

---

## Type-checked keys

`apps/web/src/i18n/i18next.d.ts` augments i18next's `CustomTypeOptions` with
`resources: { translation: typeof en }`, binding the type system to the **master
`en.json`**. As a result, every `t("…")` call is checked against the real key set:
an unknown or misspelled key is a **TypeScript error**, not a runtime surprise.

---

## Domain / UI injection boundary

The translation layer is deliberately confined to `apps/web`. The shared packages
never import an i18n library:

- **`@tundra/domain` stays dependency-free and holds no translated strings.** It
  continues to own the canonical work-item enums (`WorkItemSource`,
  `WorkItemStatus`, `WorkItemPriority`) and the navigation order/keys/routes
  (`GLOBAL_NAV` / `PROJECT_NAV`). The web layer translates the entry **keys**; the
  domain's structure is untouched, so the global/project navigation separation
  invariant is preserved.
- **`@tundra/ui` is i18n-library-free.** Every component that renders user-visible
  text (or an accessible name) exposes an **optional override prop that defaults to
  the current English string**. Existing callers and tests are unaffected; the app
  supplies translations by passing those props.
- Where text derives from a domain enum, the override is a **resolver function** so
  the app can translate without reaching into component internals. The unified
  `WorkItemList` / `WorkItemRow` take a single `labels` object
  (`WorkItemLabels`: `source` / `status` / `priority` / `due`), built in
  `apps/web/src/i18n/workItemLabels.ts` from `t` and forwarded to every row.
  Navigation `ariaLabel`s, the skip-link label, the drawer close label, and
  similar accessible names are passed the same way.

A consequence worth calling out: the translated **source** flows into the badge's
visible `label`, while the `data-source` attribute and per-source color/icon
mapping stay untouched — the **source-as-metadata** invariant and the
global/project nav separation both survive translation.

---

## API stable-code → message boundary

The API returns **stable machine codes, never localized prose**. The web app maps
those codes to translated, human-readable messages at the presentation boundary
only — **stored audit data is never localized; only its display is.** The mapping
lives in `apps/web/src/i18n/codes.ts`:

- `revertReasonMessage(t, code)` maps a `RevertResult.reason` code
  (`not_authorized`, `already_reverted`, `not_reversible`, `missing_inverse`,
  `dependent_changes`, `not_found`) to `t("audit.revert.reason.<code>")`. Unknown
  codes resolve to `audit.revert.reason.unknown`.
- `auditActionMessage(t, action)` maps an `AuditEvent.action` code (e.g.
  `workitem.status_changed`) to `t("audit.action.<action>")`. The action set is
  open-ended, so a missing key resolves to `audit.action.unknown` rather than
  echoing a raw code.

This keeps the audit trail and the API contract language-neutral and stable, while
the UI presents them in the active language.

---

## Fonts, CJK, and layout

- **No CJK webfonts are bundled.** A full CJK family is multiple megabytes per
  weight and would dwarf the bundle. Instead, `--tnd-font-sans` and
  `--tnd-font-mono` (in `packages/ui`) keep Roboto first for Latin, then append a
  broad OS CJK fallback stack — Noto Sans CJK SC/KR/JP, Hiragino, Yu Gothic,
  Meiryo, Microsoft YaHei, Malgun Gothic, Apple SD Gothic Neo — so Chinese,
  Japanese, and Korean glyphs render from the operating system's fonts while the
  download stays small.
- **Layout is translation-tolerant.** Chips, badges, and module badges use
  `white-space: nowrap` but no fixed/max width, so they grow with longer
  German/French/Spanish strings; text containers use `flex` + `min-width: 0` +
  `flex-wrap`, and the project nav scrolls rather than clips. The only single-line
  truncation is on the free-form work-item **title**, which is intentional.

---

## What is intentionally not translated

These are **demo fixture data** (`apps/web/src/data/**`) — real-looking records the
production app would load from the API/DB — not product chrome, so translating them
would misrepresent them: project/people/task names, references (e.g. `AUR-214`),
labels, sprint names, discussion/doc content, and module/report catalog names.
Also left as-is: the **Tundra** wordmark, the `⌘K` command-palette glyph, inline
numbers/units (`28.5h`, `68%`, `v2.4.0`), and design-token reference identifiers,
which are developer-facing, not localizable UI. All actual chrome — titles, leads,
headings, buttons, filters, statuses, group/column/state names, extension-point
names, accessible names, and empty/loading/error copy — **is** translated.

---

## Tooling and tests

- **Key parity / JSON validity:**
  `corepack pnpm --filter @tundra/web run i18n:check`.
- **Unit tests** (Vitest) cover language switching, English fallback for a missing
  key, per-locale key coverage, translated navigation, and My Tasks rendered in
  Polish and Japanese.
- **End-to-end** (Playwright) switches the language in the browser and asserts the
  choice persists across a reload.

See the developer guide for how to run each of these:
[`docs/development/localization.md`](../development/localization.md).
