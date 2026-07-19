/**
 * drizzle-kit configuration.
 *
 * Reads `DATABASE_URL` from the environment. Migrations are generated into
 * `./drizzle` via `corepack pnpm --filter @tundra/db db:generate`. Generation is
 * deferred; no SQL is committed yet.
 */

import { defineConfig } from "drizzle-kit";

export default defineConfig({
	dialect: "postgresql",
	schema: "./src/schema/index.ts",
	out: "./drizzle",
	dbCredentials: {
		url: process.env.DATABASE_URL ?? "postgres://tundra:tundra@localhost:5432/tundra",
	},
	strict: true,
	verbose: true,
});
