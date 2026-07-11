import { formatDateTime, formatEventDate } from "@/lib/dateFormat";

export function formatReviewEventDate(iso?: string | null): string {
  if (!iso) return "—";
  return formatEventDate(iso);
}

/** Full timestamp for review lists and detail panels. */
export function formatReviewWhen(iso: string | null | undefined): string {
  return formatDateTime(iso);
}

/** Relative label for public browse carousels. */
export function formatReviewRelative(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / (86400 * 1000));
  if (days < 1) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}
