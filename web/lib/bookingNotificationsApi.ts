import type { components } from "@/lib/api-schema";
import api from "@/lib/axios";

type NotificationMarkReadResponse = components["schemas"]["NotificationMarkReadResponse"];

export async function markClientBookingNotificationRead(notificationId: string): Promise<boolean> {
  const { data } = await api.post<NotificationMarkReadResponse>(
    `/api/v1/client/notifications/bookings/${encodeURIComponent(notificationId)}/mark-read`,
  );
  return Boolean(data.success);
}

export async function markVendorBookingNotificationRead(notificationId: string): Promise<boolean> {
  const { data } = await api.post<NotificationMarkReadResponse>(
    `/api/v1/vendor/notifications/bookings/${encodeURIComponent(notificationId)}/mark-read`,
  );
  return Boolean(data.success);
}

