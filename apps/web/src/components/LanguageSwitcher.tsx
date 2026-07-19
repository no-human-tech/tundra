import { useTranslation } from "react-i18next";

import { SUPPORTED_LANGUAGES } from "../i18n/index.js";

/**
 * Accessible language picker for the Topbar.
 *
 * A labelled native <select> listing the nine supported languages by their
 * autonym (each language's own name). Changing it calls `i18n.changeLanguage`,
 * which persists the choice to localStorage via the configured
 * `i18next-browser-languagedetector` (key `tundra_lang`) and updates the active
 * language for the whole app; we also reflect it on `<html lang>` so assistive
 * tech and the CSS lang-aware font stack pick up the change immediately.
 *
 * NOTE: the persisted preference currently lives in localStorage only. Once user
 * profiles exist, this should read/write the signed-in user's profile language
 * (with localStorage as the anonymous/pre-auth fallback).
 *
 * Rendered identically in the app Topbar and the auth header (LoginPage) —
 * both simply mount this component, so its styling (apps/web/src/styles/app.css
 * `.tnd-langswitcher`) only needs to live in one place.
 */
export function LanguageSwitcher() {
	const { i18n, t } = useTranslation();

	const current = (SUPPORTED_LANGUAGES as readonly string[]).includes(i18n.resolvedLanguage ?? "")
		? (i18n.resolvedLanguage as string)
		: "en";

	const onChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
		const next = event.target.value;
		void i18n.changeLanguage(next);
		// Keep the document language in sync for a11y + lang-aware styling.
		document.documentElement.lang = next;
	};

	return (
		<span className="tnd-langswitcher-wrap">
			<select
				className="tnd-langswitcher"
				aria-label={t("language.switcherLabel")}
				value={current}
				onChange={onChange}
			>
				{SUPPORTED_LANGUAGES.map((code) => (
					<option key={code} value={code}>
						{t(`language.names.${code}` as const)}
					</option>
				))}
			</select>
			{/* Native <select> arrows can't be restyled directly, so it's suppressed
			    (appearance:none, in CSS) and replaced with this inert chevron drawn
			    on top — mirrors the canonical design prototype's select pattern
			    (e.g. the issue-panel selects). */}
			<svg
				className="tnd-langswitcher-chevron"
				width="13"
				height="13"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
			>
				<polyline points="6 9.5 12 15.5 18 9.5" />
			</svg>
		</span>
	);
}
