import type { components } from "@/lib/api-schema";
import api from "@/lib/axios";
import type { NotificationFeedItem } from "@/lib/notificationsFeedApi";

/** The api types the preview items as free-form dicts; the real row shape is `NotificationFeedItem`. */
type WithFeedPreview = { notification_preview: { items: NotificationFeedItem[] } };

export type ClientDashboardPayload = Omit<components["schemas"]["ClientDashboardResponse"], "notification_preview"> &
  WithFeedPreview;

export type VendorDashboardPayload = Omit<components["schemas"]["VendorDashboardResponse"], "notification_preview"> &
  WithFeedPreview;

export async function fetchClientDashboard(): Promise<ClientDashboardPayload> {
  const { data } = await api.get<ClientDashboardPayload>("/api/v1/client/dashboard");
  return data;
}

export async function fetchVendorDashboard(): Promise<VendorDashboardPayload> {
  const { data } = await api.get<VendorDashboardPayload>("/api/v1/vendor/dashboard");
  return data;
}
