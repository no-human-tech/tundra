import { defineConfig } from "vitest/config";

// Integration-only config. Runs ONLY `*.integration.test.ts`, which connect to a
// real Postgres (TEST_DATABASE_URL ?? DATABASE_URL) and self-skip when neither
// is set. Invoked by `pnpm --filter @tundra/db test:integration`; never part of
// the default `pnpm test` run.
export default defineConfig({
	test: {
		include: ["**/*.integration.test.ts"],
	},
});
