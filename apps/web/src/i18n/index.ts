/**
 * i18next initialization — lazy locale loading.
 *
 * Design decisions:
 *  - Only the active language (detected from localStorage, defaulting to PL)
 *    and the English fallback are loaded at startup. All other locales are
 *    separate Vite chunks that are fetched on demand when the user switches
 *    language.
 *  - `initImmediate: false` is preserved: resources are pre-loaded via `await`
 *    before `init` is called, so the first synchronous render has strings.
 *  - `changeLanguage` is wrapped to auto-import any locale not yet in the
 *    i18next store. After the first load the module is cached, so re-switching
 *    to the same language is instant.
 *  - `i18nReady` is the Promise that resolves once init is complete. Await it
 *    in `main.tsx` before rendering and in `vitest.setup.ts` before tests.
 */

import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import {
	SUPPORTED_LANGUAGES,
	LANGUAGE_STORAGE_KEY,
	FALLBACK_LANGUAGE,
	isSupportedLanguage,
	detectInitialLanguage,
} from "./supportedLanguages.js";
import { loadLocale } from "./loadLocale.js";

export { SUPPORTED_LANGUAGES, LANGUAGE_STORAGE_KEY };
export type { SupportedLanguage } from "./supportedLanguages.js";

async function initI18n(): Promise<void> {
	// Detect the active language synchronously before any async work so we can
	// kick off the locale import as early as possible.
	const detected = detectInitialLanguage();
	const needsFallback = detected !== FALLBACK_LANGUAGE;

	// Load active + fallback locales in parallel (1–2 chunks at startup).
	const [activeLocale, fallbackLocale] = await Promise.all([
		loadLocale(detected),
		needsFallback ? loadLocale(FALLBACK_LANGUAGE) : Promise.resolve(null),
	]);

	// Build the minimal resources map that goes into i18n.init().
	const resources: Record<string, { translation: Record<string, unknown> }> = {
		[detected]: activeLocale,
	};
	if (needsFallback && fallbackLocale) {
		resources[FALLBACK_LANGUAGE] = fallbackLocale;
	}

	// Initialize synchronously (`initImmediate: false`) — resources are already
	// in-memory so there is nothing to defer, and the first render has strings.
	await i18n
		.use(LanguageDetector)
		.use(initReactI18next)
		.init({
			resources,
			// Authoritative: use the value already computed by
			// detectInitialLanguage() (localStorage -> DEFAULT_LANGUAGE) instead of
			// letting i18next-browser-languagedetector re-run its own detection
			// pass — without this, an unsupported/missing stored preference falls
			// through to i18next's OWN fallbackLng ("en") rather than
			// DEFAULT_LANGUAGE ("pl"), silently ignoring the app's chosen default
			// for new visitors. The detector plugin stays registered for its other
			// job: caching later `changeLanguage` calls back to localStorage (see
			// `detection.caches` below).
			lng: detected,
			fallbackLng: FALLBACK_LANGUAGE,
			supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
			load: "languageOnly",
			nonExplicitSupportedLngs: true,
			initImmediate: false,
			detection: {
				order: ["localStorage"],
				caches: ["localStorage"],
				lookupLocalStorage: LANGUAGE_STORAGE_KEY,
			},
			interpolation: {
				escapeValue: false,
			},
			returnNull: false,
			returnEmptyString: false,
			react: {
				useSuspense: false,
			},
		});

	// Wrap changeLanguage so switching to an unloaded locale transparently fetches
	// its chunk first. The i18next resource store caches the bundle after the first
	// load, so repeated switches to the same language don't re-import.
	const nativeChangeLanguage = i18n.changeLanguage.bind(i18n);

	i18n.changeLanguage = (async (
		lang?: string,
		callback?: Parameters<typeof i18n.changeLanguage>[1],
	) => {
		const target = lang && isSupportedLanguage(lang) ? lang : undefined;
		if (target && !i18n.hasResourceBundle(target, "translation")) {
			const data = await loadLocale(target);
			i18n.addResourceBundle(target, "translation", data.translation, true, false);
			// Always keep the English fallback loaded.
			if (!i18n.hasResourceBundle(FALLBACK_LANGUAGE, "translation")) {
				const en = await loadLocale(FALLBACK_LANGUAGE);
				i18n.addResourceBundle(FALLBACK_LANGUAGE, "translation", en.translation, true, false);
			}
		}
		return nativeChangeLanguage(lang, callback);
	}) as typeof i18n.changeLanguage;
}

/**
 * Resolves once i18next has finished initializing with the active locale loaded
 * and the lazy-load wrapper installed on `changeLanguage`.
 */
export const i18nReady: Promise<void> = initI18n();

export default i18n;
