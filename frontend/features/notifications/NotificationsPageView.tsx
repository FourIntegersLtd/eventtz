"use client";

import Link from "next/link";
import { Bell, CalendarClock, MessageCircle, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import {
  fetchClientNotificationsFeed,
  fetchVendorNotificationsFeed,
  type NotificationFeedItem,
} from "@/lib/notificationsFeedApi";
import { markAllClientBookingNotificationsRead } from "@/lib/clientNotificationsApi";
import { markAllVendorBookingNotificationsRead } from "@/lib/vendorNotificationsApi";
import { formatDateTime } from "@/lib/dateFormat";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonListRows } from "@/components/ui/Skeleton";
import { useRealtimeRefresh } from "@/lib/realtimeHooks";

type NotificationsPageViewProps = {
  portal: "client" | "vendor";
};

const KIND_ICON: Record<NotificationFeedItem["kind"], typeof Bell> = {
  booking_update: CalendarClock,
  dispute_update: ShieldAlert,
  chat_unread_summary: MessageCircle,
};

/**
 * Full notification history for one portal — the destination behind the bell
 * dropdown's "View all" link. Opening this page marks booking notifications
 * read, mirroring the dropdown's behaviour.
 */
export function NotificationsPageView({ portal }: NotificationsPageViewProps) {
  const [items, setItems] = useState<NotificationFeedItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFeed = portal === "client" ? fetchClientNotificationsFeed : fetchVendorNotificationsFeed;
  const markAllRead =
    portal === "client" ? markAllClientBookingNotificationsRead : markAllVendorBookingNotificationsRead;

  const load = () => {
    setLoading(true);
    setError(null);
    void fetchFeed()
      .then((feed) => setItems(feed))
      .catch(() => setError("Could not load notifications."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    void markAllRead().catch(() => {
      /* best-effort — the feed still renders either way */
    });
    // Runs once per mount; `load`/`markAllRead` are stable for a given portal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portal]);

  useRealtimeRefresh(
    ["booking_notifications:refresh", "chat:unread_refresh", "disputes:refresh"],
    load,
    [portal],
  );

  return (
    <div className="w-full min-w-0 max-w-3xl">
      {error ? (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="rounded-2xl border border-neutral-200 bg-white">
        {loading ? (
          <div className="p-3">
            <SkeletonListRows rows={5} />
          </div>
        ) : !items || items.length === 0 ? (
          <EmptyState
            className="border-0"
            icon={<Bell className="h-8 w-8" strokeWidth={1.5} />}
            title="You're all caught up"
          />
        ) : (
          <ul>
            {items.map((item, i) => {
              const Icon = KIND_ICON[item.kind] ?? Bell;
              const content = (
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-neutral-900">{item.title}</p>
                    {item.body ? (
                      <p className="mt-0.5 line-clamp-2 text-sm text-neutral-500">{item.body}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-neutral-400">{formatDateTime(item.created_at)}</p>
                  </div>
                  {item.unread ? (
                    <span
                      className="mt-1.5 h-2 w-2 flex-none rounded-full bg-primary"
                      aria-label="Unread"
                    />
                  ) : null}
                </div>
              );
              return (
                <li
                  key={`${item.notification_id ?? item.booking_id ?? i}-${i}`}
                  className="border-b border-neutral-100 last:border-b-0"
                >
                  {item.href ? (
                    <Link
                      href={item.href}
                      className="block min-h-11 px-4 py-3.5 transition duration-150 ease-out hover:bg-neutral-50 active:bg-neutral-100"
                    >
                      {content}
                    </Link>
                  ) : (
                    <div className="px-4 py-3">{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
