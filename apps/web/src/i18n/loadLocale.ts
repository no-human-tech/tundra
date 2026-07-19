import type { SupportedLanguage } from "./supportedLanguages.js";

/** Shape of every locale JSON file (one `translation` namespace). */
export type LocaleModule = { translation: Record<string, unknown> };

/**
 * Dynamically imports a locale JSON as a separate Vite chunk.
 *
 * Each `case` uses a string literal so Rollup can statically analyze the
 * import graph and emit one chunk per locale — none end up in the entry bundle.
 * After the first call for a given language the module is cached by the browser
 * and by the JS engine's module registry, so re-imports are instant.
 */
export async function loadLocale(lang: SupportedLanguage): Promise<LocaleModule> {
	switch (lang) {
		case "en":
			return (await import("./locales/en.json")).default as LocaleModule;
		case "pl":
			return (await import("./locales/pl.json")).default as LocaleModule;
		case "de":
			return (await import("./locales/de.json")).default as LocaleModule;
		case "es":
			return (await import("./locales/es.json")).default as LocaleModule;
		case "fr":
			return (await import("./locales/fr.json")).default as LocaleModule;
		case "it":
			return (await import("./locales/it.json")).default as LocaleModule;
		case "zh":
			return (await import("./locales/zh.json")).default as LocaleModule;
		case "ko":
			return (await import("./locales/ko.json")).default as LocaleModule;
		case "ja":
			return (await import("./locales/ja.json")).default as LocaleModule;
	}
}
