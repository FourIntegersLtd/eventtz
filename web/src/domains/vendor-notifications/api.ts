/** The vendor-notifications domain's requests against `/api/v1/vendor/notifications/*`. */
import { platformRequest, type components } from "@/foundation/platform-client";

export type NotificationFeedItem = components["schemas"]["NotificationFeedItem"];

/** The vendor's dashboard/notifications feed, newest first. */
export function fetchNotificationFeed(): Promise<NotificationFeedItem[]> {
  return platformRequest<components["schemas"]["NotificationFeedResponse"]>("/api/v1/vendor/notifications/feed").then(
    (response) => response.items,
  );
}

/** How many booking notices are unread — used for the shell's bell badge. */
export function fetchUnreadBookingNotificationCount(): Promise<number> {
  return platformRequest<{ success: boolean; unread_count: number }>(
    "/api/v1/vendor/notifications/bookings/unread-count",
  ).then((response) => response.unread_count);
}

/** Mark every booking notice read, mirroring what opening this page does in the baseline. */
export function markAllBookingNotificationsRead(): Promise<void> {
  return platformRequest<void>("/api/v1/vendor/notifications/bookings/mark-all-read", { method: "POST" });
}

/** Mark one booking notice read. `success` is false when it was not one of the caller's. */
export function markBookingNotificationRead(notificationId: string): Promise<boolean> {
  return platformRequest<components["schemas"]["NotificationMarkReadResponse"]>(
    `/api/v1/vendor/notifications/bookings/${encodeURIComponent(notificationId)}/mark-read`,
    { method: "POST" },
  ).then((response) => response.success);
}
