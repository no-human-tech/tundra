#!/usr/bin/env node
/* global console, process */
/**
 * Locale key-coverage + JSON validity checker (no dependencies).
 *
 * Loads all nine locale JSON files, flattens their keys, and asserts that every
 * non-`en` locale has EXACTLY the same flattened key set as the master `en.json`
 * (reporting both MISSING and EXTRA keys per locale). Also fails on invalid JSON.
 *
 * Exits non-zero on any problem and prints a clear summary. Run via:
 *   pnpm --filter @tundra/web run i18n:check
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = join(__dirname, "..", "src", "i18n", "locales");

/** Master locale; every other locale must match its key set exactly. */
const MASTER = "en";
const LOCALES = ["en", "pl", "es", "de", "fr", "it", "zh", "ko", "ja"];

/** Recursively flatten an object into dotted key paths (leaves only). */
function flattenKeys(obj, prefix = "") {
  const keys = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      keys.push(...flattenKeys(value, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

/** Load + parse a locale file; records a JSON error instead of throwing. */
function loadLocale(code, problems) {
  const file = join(LOCALES_DIR, `${code}.json`);
  let raw;
  try {
    raw = readFileSync(file, "utf8");
  } catch (err) {
    problems.push(`[${code}] cannot read ${file}: ${err.message}`);
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    problems.push(`[${code}] invalid JSON in ${file}: ${err.message}`);
    return null;
  }
}

function main() {
  const problems = [];

  // Master must be valid first; nothing to compare against otherwise.
  const master = loadLocale(MASTER, problems);
  if (!master) {
    console.error("FAIL: master locale could not be loaded.\n  " + problems.join("\n  "));
    process.exit(1);
  }
  const masterKeys = new Set(flattenKeys(master));
  console.log(`Master "${MASTER}": ${masterKeys.size} keys.`);

  for (const code of LOCALES) {
    if (code === MASTER) continue;
    const data = loadLocale(code, problems);
    if (!data) continue; // JSON error already recorded.

    const keys = new Set(flattenKeys(data));
    const missing = [...masterKeys].filter((k) => !keys.has(k));
    const extra = [...keys].filter((k) => !masterKeys.has(k));

    if (missing.length === 0 && extra.length === 0) {
      console.log(`  OK  ${code}: ${keys.size} keys (exact match).`);
    } else {
      if (missing.length > 0) {
        problems.push(`[${code}] missing ${missing.length} key(s):\n      ${missing.join("\n      ")}`);
      }
      if (extra.length > 0) {
        problems.push(`[${code}] extra ${extra.length} key(s):\n      ${extra.join("\n      ")}`);
      }
      console.log(`  ERR ${code}: ${missing.length} missing, ${extra.length} extra.`);
    }
  }

  if (problems.length > 0) {
    console.error("\nLocale check FAILED:\n  " + problems.join("\n  "));
    process.exit(1);
  }

  console.log("\nLocale check PASSED: all locales match the en key set exactly.");
}

main();
