/**
 * Pure formatting helpers for the notifications domain: label mapping for a
 * feed item's `kind`, and the timestamp shown under each row.
 */
import type { NotificationFeedItem } from "@/domains/notifications/api";

/** A short, human label for a feed item's kind, used as a text badge (no icon library — AGENTS.md). */
export function notificationKindLabel(kind: NotificationFeedItem["kind"]): string {
  switch (kind) {
    case "booking_update":
      return "Booking";
    case "dispute_update":
      return "Dispute";
    case "chat_unread_summary":
      return "Messages";
    default:
      return "Update";
  }
}

/** Date and time for a feed row, e.g. "26 Sep, 14:05". Falls back to an empty string for an unknown timestamp. */
export function formatNotificationTimestamp(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const datePart = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(date);
  const timePart = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" }).format(
    date,
  );
  return `${datePart}, ${timePart}`;
}

/** The bell badge's text, capped so a long-unread vendor doesn't blow out the layout. */
export function formatUnreadCount(count: number): string {
  return count > 99 ? "99+" : String(count);
}
