import api from "@/lib/axios";

export type NotificationFeedItem = {
  kind: "booking_update" | "dispute_update" | "chat_unread_summary";
  created_at: string | null;
  title: string;
  body: string | null;
  notification_id: string | null;
  booking_id: string | null;
  href: string | null;
  unread: boolean | null;
};

export async function fetchClientNotificationsFeed(): Promise<NotificationFeedItem[]> {
  const { data } = await api.get<{ success: boolean; items: NotificationFeedItem[] }>(
    "/api/v1/client/notifications/feed",
  );
  return data.items ?? [];
}

export async function fetchVendorNotificationsFeed(): Promise<NotificationFeedItem[]> {
  const { data } = await api.get<{ success: boolean; items: NotificationFeedItem[] }>(
    "/api/v1/vendor/notifications/feed",
  );
  return data.items ?? [];
}

