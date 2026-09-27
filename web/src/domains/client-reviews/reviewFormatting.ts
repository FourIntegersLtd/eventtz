/**
 * Pure formatting for the client's own reviews: the per-row subtitle, a text
 * star rating (no icon library — AGENTS.md), and the "when" timestamp.
 */

/** The row subtitle joins the event name and date, dropping the date when absent. */
export function formatReviewSubtitle(eventName: string, eventDate: string): string {
  return eventDate ? `${eventName} · ${eventDate}` : eventName;
}

/** A five-point rating as filled/unfilled stars (always five wide), e.g. `"★★★☆☆"`, clamped to 0–5. */
export function starRating(rating: number): string {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));
  return "★".repeat(filled) + "☆".repeat(5 - filled);
}

/** Full timestamp for a review footer, e.g. "12 Jul 2026, 14:03"; "-" when missing. */
export function formatReviewTimestamp(iso: string | null | undefined): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}
