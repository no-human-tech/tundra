// Flat ESLint config (ESLint 9 + typescript-eslint).
// Intentionally lightweight for the foundation: lint stays fast and does not
// require full type information. Tighten incrementally as the codebase grows.
import js from "@eslint/js";
import jsdoc from "eslint-plugin-jsdoc";
import tseslint from "typescript-eslint";

export default tseslint.config(
	{
		ignores: [
			"**/dist/**",
			"**/build/**",
			"**/coverage/**",
			"**/.turbo/**",
			"**/node_modules/**",
			"**/*.config.js",
			"**/*.config.ts",
		],
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		files: ["**/*.{ts,tsx}"],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: "module",
		},
		rules: {
			"@typescript-eslint/no-unused-vars": [
				"error",
				{ argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
			],
			"@typescript-eslint/no-explicit-any": "warn",
			"@typescript-eslint/consistent-type-imports": [
				"warn",
				{ prefer: "type-imports", fixStyle: "inline-type-imports" },
			],
		},
	},

	// ----- Module boundary enforcement -----
	// Uses the built-in `no-restricted-imports` rule (no extra dependencies). The
	// file globs below are disjoint, so each file gets exactly one rule config
	// (ESLint does not merge a rule's options across matching blocks).

	// `@tundra/domain` is dependency-free: it must not import any other @tundra package.
	{
		files: ["packages/domain/**/*.{ts,tsx}"],
		rules: {
			"no-restricted-imports": [
				"error",
				{
					patterns: [
						{
							group: ["@tundra/*", "@tundra/*/*"],
							message:
								"packages/domain is dependency-free and must not import other @tundra packages.",
						},
					],
				},
			],
		},
	},

	// The web app and the UI package must never import the database package.
	{
		files: ["apps/web/**/*.{ts,tsx}", "packages/ui/**/*.{ts,tsx}"],
		rules: {
			"no-restricted-imports": [
				"error",
				{
					patterns: [
						{
							group: ["@tundra/db", "@tundra/db/*"],
							message:
								"The web app and @tundra/ui must not import @tundra/db; reach persistence through the API.",
						},
					],
				},
			],
		},
	},

	// The remaining packages must never import apps (packages sit below apps).
	{
		files: [
			"packages/config/**/*.{ts,tsx}",
			"packages/modules-sdk/**/*.{ts,tsx}",
			"packages/db/**/*.{ts,tsx}",
			"packages/test-utils/**/*.{ts,tsx}",
		],
		rules: {
			"no-restricted-imports": [
				"error",
				{
					patterns: [
						{
							group: [
								"@tundra/api",
								"@tundra/api/*",
								"@tundra/web",
								"@tundra/web/*",
								"@tundra/worker",
								"@tundra/worker/*",
							],
							message: "Packages must not import apps (@tundra/api, @tundra/web, @tundra/worker).",
						},
					],
				},
			],
		},
	},

	// ----- JSDoc policy for the public API packages -----
	// Scoped to the domain core and the module SDK — the contracts other code and
	// module authors build against. Correctness of any written JSDoc is enforced
	// (these rules no-op when a symbol has no JSDoc); PRESENCE of JSDoc on exported
	// declarations is surfaced at "warn" (guidance now, ratcheting to "error" once
	// the surface stabilizes). TS already provides types, so type tags are not
	// required. See docs/development/code-style.md.
	{
		files: ["packages/domain/**/*.ts", "packages/modules-sdk/**/*.ts"],
		ignores: ["**/*.test.ts"],
		plugins: { jsdoc },
		settings: { jsdoc: { mode: "typescript" } },
		rules: {
			"jsdoc/check-alignment": "error",
			"jsdoc/check-param-names": "error",
			"jsdoc/check-property-names": "error",
			"jsdoc/empty-tags": "error",
			"jsdoc/no-multi-asterisks": "error",
			"jsdoc/require-param-description": "warn",
			"jsdoc/require-returns-description": "warn",
			"jsdoc/require-jsdoc": [
				"warn",
				{
					publicOnly: true,
					require: { FunctionDeclaration: true, ClassDeclaration: true },
					contexts: [
						"ExportNamedDeclaration > FunctionDeclaration",
						"ExportNamedDeclaration > TSInterfaceDeclaration",
						"ExportNamedDeclaration > TSTypeAliasDeclaration",
						"ExportNamedDeclaration > TSEnumDeclaration",
					],
				},
			],
		},
	},
);
