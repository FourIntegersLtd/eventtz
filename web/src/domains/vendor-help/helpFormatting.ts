/** Pure formatting helpers for the Help Center: turning a slug into a readable label. */

/**
 * "vendor-payouts-explained" -> "payouts explained". Strips the audience
 * prefix the API's article slugs carry and swaps dashes for spaces, matching
 * how the baseline links a related-article slug when only the slug (not its
 * title) is known.
 */
export function slugToLabel(slug: string): string {
  return slug.replace(/^(client|vendor|admin)-/, "").replace(/-/g, " ");
}

/** A message-list row's timestamp, e.g. "14:05". */
export function formatSupportMessageTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" }).format(date);
}
