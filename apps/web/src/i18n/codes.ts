/**
 * Backend code -> translated message boundary.
 *
 * The API returns STABLE machine codes, never localized prose, for two presentation
 * concerns:
 *   - `RevertResult.reason` codes (why an audit revert failed), and
 *   - `AuditEvent.action` codes (what an audit event did).
 *
 * The web app maps those codes to translated, human-readable messages at the
 * presentation boundary ONLY — stored audit data is never localized; only its
 * display is. Unknown codes fall back to a generic English-safe message (the
 * `unknown` key in each group), so a new/unexpected code from the backend can
 * never render a raw code or break the UI.
 *
 * These helpers take a `t` function (from `useTranslation()` /
 * `i18n.getFixedT(...)`) so they stay framework-friendly and testable.
 */

import type { TFunction } from "i18next";

/** Revert-failure reason codes returned by `RevertResult.reason`. */
export const REVERT_REASON_CODES = [
	"not_authorized",
	"already_reverted",
	"not_reversible",
	"missing_inverse",
	"dependent_changes",
	"not_found",
] as const;

export type RevertReasonCode = (typeof REVERT_REASON_CODES)[number];

/**
 * Map a `RevertResult.reason` code to a translated message. Unknown codes resolve
 * to the generic `audit.revert.reason.unknown` message (English fallback).
 */
export function revertReasonMessage(t: TFunction, code: string | null | undefined): string {
	const known = (REVERT_REASON_CODES as readonly string[]).includes(code ?? "");
	const key = known ? `audit.revert.reason.${code}` : "audit.revert.reason.unknown";
	return t(key as never);
}

/**
 * Map an `AuditEvent.action` code (e.g. `workitem.status_changed`) to a translated
 * presentation string. Unknown actions resolve to `audit.action.unknown`.
 *
 * The set of action codes is open-ended on the backend, so this does not maintain
 * an exhaustive list — it tries the specific key and falls back if the runtime
 * resource lacks it.
 */
export function auditActionMessage(t: TFunction, action: string | null | undefined): string {
	if (!action) return t("audit.action.unknown" as never);
	// `defaultValue` makes a missing action key resolve to the generic message
	// instead of echoing the raw code.
	const fallback = t("audit.action.unknown" as never);
	return t(`audit.action.${action}` as never, { defaultValue: fallback });
}
