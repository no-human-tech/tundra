/** Supported locale codes; `en` is the default + fallback. */
export const SUPPORTED_LANGUAGES = ["en", "pl", "es", "de", "fr", "it", "zh", "ko", "ja"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** localStorage key the detector reads/writes the persisted preference under. */
export const LANGUAGE_STORAGE_KEY = "tundra_lang";

/**
 * Language always loaded at startup as i18next's linguistic fallback for keys
 * missing from the active locale (English is the base language new keys are
 * written in first, so it's the most complete).
 */
export const FALLBACK_LANGUAGE = "en" as const satisfies SupportedLanguage;

/**
 * The app's default language for a first-time visitor with no stored
 * preference and an unsupported/undetectable browser language —
 * The design spec §3: "Aplikacja: ... domyślnie PL". Distinct from
 * `FALLBACK_LANGUAGE`, which is about translation-key completeness, not
 * which language a new visitor lands on.
 */
export const DEFAULT_LANGUAGE = "pl" as const satisfies SupportedLanguage;

export function isSupportedLanguage(lang: string): lang is SupportedLanguage {
	return (SUPPORTED_LANGUAGES as readonly string[]).includes(lang);
}

/**
 * Detects the active language synchronously — reads localStorage for an
 * explicit user preference only. The app does NOT
 * fall back to `navigator.language` (the design spec §3: the app defaults
 * to PL for first-time visitors, regardless of browser locale). Safe to call
 * before i18next initializes so we can start the locale import in parallel.
 */
export function detectInitialLanguage(): SupportedLanguage {
	if (typeof window === "undefined") return DEFAULT_LANGUAGE;
	try {
		const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
		if (stored && isSupportedLanguage(stored)) return stored;
	} catch {
		// localStorage blocked in some browser contexts (private mode, etc.)
	}
	return DEFAULT_LANGUAGE;
}
