# Localization guide

This is the practical guide to translations in the Tundra web app: adding or
changing a key, adding a new language, and running the checks. For the design and
the boundaries behind it (domain/UI injection, the API code-mapping, fonts), see
[`docs/architecture/internationalization.md`](../architecture/internationalization.md)
and [ADR-0011](../adr/ADR-0011-internationalization.md).

Everything lives in `apps/web`:

```
apps/web/
  src/i18n/
    index.ts            # i18next init (bundled locales, fallback, detection)
    i18next.d.ts        # type augmentation: t() keys checked against en.json
    codes.ts            # API stable-code -> translated message helpers
    workItemLabels.ts   # builds the @tundra/ui WorkItemLabels resolver from t
    locales/<code>.json # one file per locale, single `translation` namespace
  src/components/LanguageSwitcher.tsx
  scripts/check-locales.mjs
```

---

## The English-master rule

`apps/web/src/i18n/locales/en.json` is the **authoritative master**. It defines
the canonical key set; every other locale must mirror it **exactly** — no missing
keys, no extra keys. Two rules follow from this:

1. **Always edit `en.json` first**, then mirror the change into every other
   locale.
2. A missing key in any locale resolves to the English master at runtime, so the
   UI never breaks — but the locale will **fail `i18n:check`** until it matches.

---

## Add or change a translation key

1. **Add/edit the key in `en.json`** under the appropriate group (use existing
   nesting; reuse `common.*` for shared words). Use `{{interpolation}}`
   placeholders rather than string concatenation.
2. **Mirror the key into all other locale files**
   (`pl, es, de, fr, it, zh, ko, ja`) with a translated value, keeping the exact
   same key path.
3. **Use the typed key in code:** `t("group.yourKey")`. Because keys are type-checked
   against `en.json` (see below), a typo or missing key is a compile error.
4. **Verify parity and JSON validity:**

   ```bash
   corepack pnpm --filter @tundra/web run i18n:check
   ```

5. **Run the tests** (parity is also asserted there, per locale):

   ```bash
   corepack pnpm --filter @tundra/web test
   ```

To **rename** a key, change it in `en.json` and every locale, then update the
call sites — TypeScript will flag the old key everywhere it is still used.

---

## Add a new language

1. **Create the locale file.** Copy `en.json` to
   `apps/web/src/i18n/locales/<code>.json` (use the ISO 639-1 code, e.g. `pt`) so
   it starts with full key parity, then translate the values. Keep the
   `language.names.*` block as **autonyms** (each language's own name), identical
   to the other files.
2. **Register it in the init** (`apps/web/src/i18n/index.ts`): import the JSON, add
   the code to `SUPPORTED_LANGUAGES`, and add it to the `resources` map. The
   switcher and `supportedLngs` derive from `SUPPORTED_LANGUAGES`, so the new
   language appears in the picker automatically once it is registered there.
3. **Add the autonym** for the new code to the `language.names.*` block in **every**
   locale file (this is what the switcher shows; the values are the same in all
   files).
4. **Check parity and run the suite:**

   ```bash
   corepack pnpm --filter @tundra/web run i18n:check
   corepack pnpm --filter @tundra/web test
   ```

5. **CJK or other scripts:** no font work is usually needed — the shared font
   stack already includes an OS CJK fallback. Confirm longer strings don't clip
   (the layout is built to grow/wrap; see the architecture doc).

---

## How typed keys work

`apps/web/src/i18n/i18next.d.ts` augments i18next's `CustomTypeOptions` so the
`translation` resource type is `typeof en` (the master). Every `t("…")` is
therefore checked against `en.json`: an unknown or misspelled key is a **TypeScript
error**. This is why `en.json` must contain a key before you can use it in code.

---

## The API code boundary

The API returns **stable machine codes**, not localized text. Do not translate
codes at the source — map them to messages at the UI boundary using the helpers in
`apps/web/src/i18n/codes.ts`:

- `revertReasonMessage(t, code)` for `RevertResult.reason` codes.
- `auditActionMessage(t, action)` for `AuditEvent.action` codes.

Both fall back to a generic `unknown` message, so a new/unexpected backend code
never renders a raw code. When the backend adds a new code, add the matching
`audit.revert.reason.<code>` or `audit.action.<code>` key to `en.json` and mirror
it to the other locales.

---

## Work-item labels

UI components in `@tundra/ui` take translated text via optional props; for
work-item enums the app passes a single resolver object. Build it from `t` with
`apps/web/src/i18n/workItemLabels.ts` and pass it as the `labels` prop to
`WorkItemList` / `WorkItemRow`. The translated source flows into the badge's
visible label while `data-source` stays intact — do not translate `data-source` or
any other metadata attribute.

---

## Running the checks

```bash
# key parity across all locales + JSON validity (fast, no deps)
corepack pnpm --filter @tundra/web run i18n:check

# unit tests: switching, English fallback, per-locale parity, translated nav,
# My Tasks in pl + ja
corepack pnpm --filter @tundra/web test

# browser e2e: switch language, assert it persists across a reload
corepack pnpm --filter @tundra/web e2e:install   # one-time: download Chromium
corepack pnpm e2e
```

Run `i18n:check` and `test` before pushing any translation change.

---

## A note on translation quality

The shipped non-English translations are **initial, AI-assisted** translations.
They are functional and key-complete, but native-speaker review is very welcome —
corrections to wording, tone, and terminology in any locale are a great
first contribution. Edit the relevant `locales/<code>.json`, keep key parity, run
`i18n:check`, and open a PR.
