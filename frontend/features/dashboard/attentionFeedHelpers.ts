import type { NotificationFeedItem } from "@/lib/notificationsFeedApi";

/** Drop feed rows that duplicate live booking rows already shown above in the feed. */
export function dashboardNotificationUpdates(
  updates: NotificationFeedItem[],
  coveredBookingIds: ReadonlySet<string>,
): NotificationFeedItem[] {
  return updates.filter((it) => {
    if (!it.unread || it.kind === "chat_unread_summary") return false;
    if (it.booking_id && coveredBookingIds.has(it.booking_id)) return false;
    return true;
  });
}
