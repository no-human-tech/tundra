/**
 * Locale-aware decimal formatting for hour/effort values shown across the
 * time-tracking screens (project timesheet, global "My Time"). Plain
 * `.toFixed(1)` always renders a `.` separator; PL (and most non-English
 * locales) expects a `,` decimal fraction — see the design spec §3.
 */

/** Format a numeric hour/decimal value to one fraction digit using the active locale's decimal separator. */
export function formatDecimalHours(value: number, locale: string): string {
	return new Intl.NumberFormat(locale, {
		minimumFractionDigits: 1,
		maximumFractionDigits: 1,
	}).format(value);
}
