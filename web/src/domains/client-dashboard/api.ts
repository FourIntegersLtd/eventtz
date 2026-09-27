/**
 * The client-dashboard domain's requests against the client's bookings, chat
 * and notification endpoints. Each is a thin `platformRequest` wrapper; the
 * domain may not import another domain, so it mirrors the `vendor-dashboard`
 * and `notifications` domains rather than reusing their `api.ts` files.
 */
import { platformRequest, type components } from "@/foundation/platform-client";

/** One row of the client's bookings list, as the dashboard reads it. */
export type ClientBookingListItem = components["schemas"]["ClientBookingListItem"];
type ClientBookingsListResponse = components["schemas"]["ClientBookingsListResponse"];

/** One line in the dashboard feed: a booking notice, a dispute, or the unread-chat summary. */
export type NotificationFeedItem = components["schemas"]["NotificationFeedItem"];
type NotificationFeedResponse = components["schemas"]["NotificationFeedResponse"];

/** The client's active or completed bookings. */
export async function fetchClientBookings(group: "active" | "completed"): Promise<ClientBookingListItem[]> {
  const response = await platformRequest<ClientBookingsListResponse>("/api/v1/client/booking-requests", {
    query: { group },
  });
  return response.bookings;
}

/** How many chat messages are unread across the client's conversations. */
export async function fetchChatUnreadCount(): Promise<number> {
  const response = await platformRequest<components["schemas"]["ChatUnreadCountResponse"]>("/api/v1/chat/unread-count");
  return response.unread_count;
}

/** The client's dashboard notification feed, newest first. */
export async function fetchClientNotificationFeed(): Promise<NotificationFeedItem[]> {
  const response = await platformRequest<NotificationFeedResponse>("/api/v1/client/notifications/feed");
  return response.items;
}
