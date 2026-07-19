/**
 * Cross-platform wrapper that runs `drizzle-kit` under the `tsx` ESM loader.
 *
 * Why this exists: drizzle-kit's bundled loader resolves TypeScript via
 * esbuild-register, which cannot follow the explicit `.js` import specifiers our
 * ESM sources (and the `@tundra/domain` workspace package) use under
 * `moduleResolution: "bundler"`. Running drizzle-kit with `tsx` injected into
 * `NODE_OPTIONS` makes those `.js`→`.ts` imports resolve, so schema loading
 * works the same way it does for tsc/vitest/tsx everywhere else.
 *
 * Usage (via package scripts): `node scripts/drizzle-kit.mjs generate`.
 */

/* global process */

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);

// Resolve the installed binaries from this package's perspective so the wrapper
// works regardless of hoisting layout. drizzle-kit does not expose ./bin.cjs in
// its `exports`, so resolve its main entry and join the bin path (same dir).
const drizzleKitDir = dirname(require.resolve("drizzle-kit"));
const drizzleKitBin = join(drizzleKitDir, "bin.cjs");
// `--import` needs a file:// URL for an absolute path on Windows.
const tsxLoader = pathToFileURL(require.resolve("tsx")).href;

const existing = process.env.NODE_OPTIONS ?? "";
const nodeOptions = `${existing} --import ${JSON.stringify(tsxLoader)}`.trim();

const result = spawnSync(process.execPath, [drizzleKitBin, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, NODE_OPTIONS: nodeOptions },
});

process.exit(result.status ?? 1);
