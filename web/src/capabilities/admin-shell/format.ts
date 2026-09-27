/**
 * Formatting helpers shared by every admin screen: dates and GBP amounts.
 *
 * The platform API already returns money fields (`*_gbp`) as decimal pounds
 * (not pence — see `AdminFinancialsSummary` etc. in `schema.d.ts`), so these
 * helpers only handle display formatting, never unit conversion.
 */

/**
 * `2026-09-26T10:00:00Z` -> `26 Sep 2026`. Returns a placeholder for a missing value.
 *
 * Formatted in UTC deliberately: the admin console has no per-user timezone
 * setting, and pinning to UTC keeps the value identical for every admin and
 * in tests, rather than drifting with the server or browser's local zone.
 */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** `2026-09-26T10:00:00Z` -> `26 Sep 2026, 10:00`. Returns a placeholder for a missing value. UTC, see `formatDate`. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

/** `1234.5` -> `£1,234.50`. Returns a placeholder for a missing value. */
export function formatGbp(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);
}

/** `booking_request` -> `Booking request`. Used for enum-ish values shown as labels. */
export function humanize(value: string | null | undefined): string {
  if (!value) return "-";
  const spaced = value.replace(/[_-]+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
