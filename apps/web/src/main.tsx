import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

// Self-hosted fonts (no external CDN; honors the strict CSP / no vendor lock-in).
// Roboto for UI/body/headings; Roboto Mono for machine details. Imported BEFORE
// the @tundra/ui CSS so the @font-face rules are registered before tokens set
// --tnd-font-sans / --tnd-font-mono.
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import "@fontsource/roboto/800.css";
import "@fontsource/roboto/900.css";
import "@fontsource/roboto-mono/400.css";
import "@fontsource/roboto-mono/500.css";
import "@fontsource/roboto-mono/600.css";

// Design system styles — tokens first, then reset + base + component styles.
import "@tundra/ui/tokens.css";
import "@tundra/ui/styles.css";

// App-level page scaffolding (built on the same tokens; component CSS lives in ui).
import "./styles/app.css";

// i18n module: exports i18nReady (Promise that resolves once the active locale
// is loaded) and the i18n instance. We await i18nReady before rendering so the
// very first paint has translated strings — no flash of raw translation keys.
import i18n, { i18nReady } from "./i18n/index.js";
import { App } from "./App.js";

// Reflect the detected/active language on <html lang> for accessibility and the
// lang-aware font stack, and keep it in sync on every language change.
function syncHtmlLang(lng: string): void {
	document.documentElement.lang = lng;
}

async function main() {
	// Block rendering until the active locale chunk has loaded. With a warm
	// browser cache this resolves in microseconds; on cold load it adds one
	// small fetch (the locale JSON chunk) before the first React render.
	await i18nReady;

	syncHtmlLang(i18n.resolvedLanguage ?? "en");
	i18n.on("languageChanged", syncHtmlLang);

	const rootElement = document.getElementById("root");
	if (!rootElement) {
		throw new Error("Root element #root not found");
	}

	createRoot(rootElement).render(
		<StrictMode>
			{/* Opt into the v7 behaviors early (silences the console warnings) —
			    both are no-op for this app's route structure: no code relies on
			    pre-v7 relative-splat resolution, and StrictMode already exercises
			    concurrent rendering. */}
			<BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
				<App />
			</BrowserRouter>
		</StrictMode>,
	);
}

void main();
