import type { components } from "@/lib/api-schema";
import api from "@/lib/axios";

import { DEFAULT_LIST_PAGE_SIZE } from "@/lib/listPageSize";
export type NotificationFeedItem = components["schemas"]["NotificationFeedItem"];

export type NotificationFeedReadState = "all" | "unread";
export type NotificationFeedTopic = "all" | "bookings" | "payments" | "messages";

export const NOTIFICATIONS_FEED_PAGE_SIZE = DEFAULT_LIST_PAGE_SIZE;
export const NOTIFICATIONS_FEED_PREVIEW_SIZE = 5;

async function fetchNotificationsFeedPage(
  path: string,
  offset = 0,
  limit = NOTIFICATIONS_FEED_PAGE_SIZE,
  readState: NotificationFeedReadState = "all",
  topic: NotificationFeedTopic = "all",
): Promise<{ items: NotificationFeedItem[]; total: number; offset: number; limit: number }> {
  const { data } = await api.get<components["schemas"]["NotificationFeedResponse"]>(path, { params: { offset, limit, read_state: readState, topic } });
  return {
    items: data.items ?? [],
    total: data.total ?? 0,
    offset: data.offset ?? offset,
    limit: data.limit ?? limit,
  };
}

export async function fetchClientNotificationsFeedPage(
  offset = 0,
  limit = NOTIFICATIONS_FEED_PAGE_SIZE,
  readState: NotificationFeedReadState = "all",
  topic: NotificationFeedTopic = "all",
) {
  return fetchNotificationsFeedPage(
    "/api/v1/client/notifications/feed",
    offset,
    limit,
    readState,
    topic,
  );
}

export async function fetchVendorNotificationsFeedPage(
  offset = 0,
  limit = NOTIFICATIONS_FEED_PAGE_SIZE,
  readState: NotificationFeedReadState = "all",
  topic: NotificationFeedTopic = "all",
) {
  return fetchNotificationsFeedPage(
    "/api/v1/vendor/notifications/feed",
    offset,
    limit,
    readState,
    topic,
  );
}

/** Short preview for the bell and dashboard (not the full history). */
export async function fetchClientNotificationsFeedPreview(): Promise<NotificationFeedItem[]> {
  const page = await fetchClientNotificationsFeedPage(0, NOTIFICATIONS_FEED_PREVIEW_SIZE);
  return page.items;
}

export async function fetchVendorNotificationsFeedPreview(): Promise<NotificationFeedItem[]> {
  const page = await fetchVendorNotificationsFeedPage(0, NOTIFICATIONS_FEED_PREVIEW_SIZE);
  return page.items;
}
