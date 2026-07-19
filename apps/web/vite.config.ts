/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
	plugins: [react()],
	server: {
		port: 5173,
	},
	build: {
		rollupOptions: {
			output: {
				// Stable vendor chunks — kept separate from app code so browser
				// caches survive app updates that don't touch third-party code.
				manualChunks: {
					"vendor-react": ["react", "react-dom", "react-router-dom"],
					"vendor-i18n": ["i18next", "react-i18next", "i18next-browser-languagedetector"],
				},
			},
		},
	},
	test: {
		environment: "jsdom",
		globals: true,
		setupFiles: ["./vitest.setup.ts"],
		include: ["src/**/*.{test,spec}.{ts,tsx}"],
	},
});
