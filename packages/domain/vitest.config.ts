import { defineConfig } from "vitest/config";

// Coverage for the dependency-free domain core. The domain holds the product's
// load-bearing invariants (WorkItem aggregation, navigation separation, revert
// authorization), so it carries the strictest coverage bar in the repo.
export default defineConfig({
	test: {
		coverage: {
			provider: "v8",
			reporter: ["text", "text-summary", "html"],
			include: ["src/**/*.ts"],
			exclude: ["src/**/*.test.ts", "src/index.ts"],
			thresholds: {
				statements: 90,
				branches: 85,
				functions: 90,
				lines: 90,
			},
		},
	},
});
