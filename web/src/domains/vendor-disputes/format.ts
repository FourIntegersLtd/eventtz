/**
 * Display-only formatters for the vendor disputes domain.
 *
 * Kept separate from `domains/vendor-bookings/format.ts` even though a
 * couple of these functions overlap it: a domain may import only itself,
 * `capability` and `foundation` (`eslint.config.mjs`'s boundaries rule), so
 * two independent product areas each keep their own small copy rather than
 * one reaching into the other.
 */

const DISPUTE_STATUS_LABELS: Readonly<Record<string, string>> = {
  open: "Open",
  under_review: "Under review",
  resolved: "Resolved",
  closed: "Closed",
};

/** A human label for a dispute's `status`; falls back to the raw code for one the frontend doesn't know yet. */
export function disputeStatusLabel(status: string): string {
  return DISPUTE_STATUS_LABELS[status] ?? status;
}

/** Formats an ISO date (or datetime) string for a person, e.g. "12 Jun 2026". */
export function formatEventDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "Date to be confirmed";
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(parsed);
}
