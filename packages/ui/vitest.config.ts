import { defineConfig } from "vitest/config";

// Coverage for the design-system component library. Thresholds are intentionally
// NOT enforced yet: the UI surface is large and presentational, its tests focus
// on the load-bearing behaviors (source-as-metadata badges, nav separation,
// drawer/toggle a11y), and gating a young, fast-moving component kit on a
// percentage would produce busywork rather than confidence. We report coverage
// to track it and will ratchet in thresholds once the surface stabilizes
// (see docs/development/testing-and-quality.md).
export default defineConfig({
	test: {
		coverage: {
			provider: "v8",
			reporter: ["text", "text-summary", "html"],
			include: ["src/**/*.{ts,tsx}"],
			exclude: ["src/**/*.test.{ts,tsx}", "src/index.ts", "src/**/*.d.ts"],
		},
	},
});
