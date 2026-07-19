#!/usr/bin/env node
/* global URL, console, process */
/**
 * Bundle size report for apps/web.
 *
 * Reads the Vite output in dist/assets/ and prints JS/CSS chunks sorted by
 * gzipped size (estimated via zlib). Run after `pnpm build`.
 *
 * Usage:
 *   node scripts/bundle-report.mjs
 *   pnpm --filter @tundra/web run analyze   (build + report)
 */

import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { createGzip } from "node:zlib";
import { resolve, join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const distAssets = resolve(__dirname, "../dist/assets");

async function gzipSize(filePath) {
  return new Promise((resolve, reject) => {
    let size = 0;
    createReadStream(filePath)
      .pipe(createGzip({ level: 9 }))
      .on("data", (chunk) => (size += chunk.length))
      .on("end", () => resolve(size))
      .on("error", reject);
  });
}

function kb(bytes) {
  return (bytes / 1024).toFixed(1) + " kB";
}

async function main() {
  let files;
  try {
    files = await readdir(distAssets);
  } catch {
    console.error("dist/assets not found — run `pnpm build` first.");
    process.exit(1);
  }

  const relevant = files.filter((f) => [".js", ".css"].includes(extname(f)));

  const rows = await Promise.all(
    relevant.map(async (name) => {
      const path = join(distAssets, name);
      const { size: raw } = await stat(path);
      const gz = await gzipSize(path);
      return { name, raw, gz };
    }),
  );

  rows.sort((a, b) => b.gz - a.gz);

  const nameW = Math.max(...rows.map((r) => r.name.length), 8);

  console.log("\n  Tundra web bundle report");
  console.log("  " + "─".repeat(nameW + 28));
  console.log(
    `  ${"File".padEnd(nameW)}  ${"Raw".padStart(10)}  ${"Gzip".padStart(10)}`,
  );
  console.log("  " + "─".repeat(nameW + 28));

  for (const r of rows) {
    console.log(
      `  ${r.name.padEnd(nameW)}  ${kb(r.raw).padStart(10)}  ${kb(r.gz).padStart(10)}`,
    );
  }

  console.log("  " + "─".repeat(nameW + 28));
  const totalRaw = rows.reduce((s, r) => s + r.raw, 0);
  const totalGz = rows.reduce((s, r) => s + r.gz, 0);
  console.log(
    `  ${"TOTAL".padEnd(nameW)}  ${kb(totalRaw).padStart(10)}  ${kb(totalGz).padStart(10)}`,
  );
  console.log();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
