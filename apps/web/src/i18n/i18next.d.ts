/**
 * Type augmentation that makes `t("…")` keys type-checked against the master
 * English locale. `en.json` is the authoritative key set; any key passed to `t`
 * that does not exist in `en.json` is a TypeScript error.
 */

import "i18next";

import type en from "./locales/en.json";

declare module "i18next" {
	interface CustomTypeOptions {
		defaultNS: "translation";
		resources: {
			translation: (typeof en)["translation"];
		};
		// Keep return values strings (we set returnNull:false at runtime).
		returnNull: false;
	}
}
