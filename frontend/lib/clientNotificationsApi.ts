import api from "@/lib/axios";

/** Fired after client marks booking notifications read (sidebar badge). */
export const BOOKING_NOTIFICATIONS_CLEARED_EVENT = "eventtz:booking-notifications-cleared";
/** Fired when booking notifications may have changed (SSE, status updates) and counts should refetch. */
export const BOOKING_NOTIFICATIONS_REFRESH_EVENT = "eventtz:booking-notifications-refresh";

export type BookingNotificationsUnreadResponse = {
  success: boolean;
  unread_count: number;
};

export async function fetchClientBookingNotificationsUnreadCount(): Promise<number> {
  const { data } = await api.get<BookingNotificationsUnreadResponse>(
    "/api/v1/client/notifications/bookings/unread-count",
  );
  return data.unread_count ?? 0;
}

export async function markAllClientBookingNotificationsRead(): Promise<void> {
  await api.post("/api/v1/client/notifications/bookings/mark-all-read");
}
