import api from "@/lib/axios";

export type BookingNotificationsUnreadResponse = {
  success: boolean;
  unread_count: number;
};

export async function fetchVendorBookingNotificationsUnreadCount(): Promise<number> {
  const { data } = await api.get<BookingNotificationsUnreadResponse>(
    "/api/v1/vendor/notifications/bookings/unread-count",
  );
  return data.unread_count ?? 0;
}

export async function markAllVendorBookingNotificationsRead(): Promise<void> {
  await api.post("/api/v1/vendor/notifications/bookings/mark-all-read");
}

