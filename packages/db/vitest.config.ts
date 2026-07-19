import { defineConfig } from "vitest/config";

// The default `pnpm test` run is unit-only and needs NO database: integration
// tests (*.integration.test.ts) are excluded here. Run them explicitly with
// `pnpm --filter @tundra/db test:integration` against a Postgres pointed to by
// TEST_DATABASE_URL (or DATABASE_URL); they self-skip when neither is set.
export default defineConfig({
	test: {
		exclude: ["**/node_modules/**", "**/dist/**", "**/*.integration.test.ts"],
		coverage: {
			provider: "v8",
			reporter: ["text", "text-summary", "html"],
			include: ["src/**/*.ts"],
			exclude: ["src/**/*.test.ts", "src/index.ts"],
		},
	},
});
