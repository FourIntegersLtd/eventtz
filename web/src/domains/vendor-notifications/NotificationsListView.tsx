"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Spinner } from "@/foundation/ui";
import { useRealtimeStream } from "@/capabilities/realtime-stream/useRealtimeStream";
import { fetchNotificationFeed, markAllBookingNotificationsRead, type NotificationFeedItem } from "@/domains/vendor-notifications/api";
import { formatNotificationTimestamp, notificationKindLabel } from "@/domains/vendor-notifications/notificationFormatting";

/**
 * Full notification history for the vendor portal — booking updates,
 * dispute updates and the unread-chat summary, newest first.
 *
 * Marks booking notifications read on mount (mirroring the baseline's
 * `NotificationsPageView`) and refetches live over the realtime stream so a
 * new notice appears without a manual reload.
 */
export function NotificationsListView() {
  const [items, setItems] = useState<NotificationFeedItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadFeed = useCallback(async () => {
    try {
      const feed = await fetchNotificationFeed();
      setItems(feed);
      setError(null);
    } catch {
      setError("Could not load notifications.");
    }
  }, []);

  // Dedupe concurrent callers (mount + a realtime refresh landing at once)
  // behind one in-flight promise — the same shape as `VendorPaymentsView`'s
  // `refreshStatus`/`loadStatus` split.
  const loadInFlight = useRef<Promise<void> | null>(null);
  const load = useCallback(() => {
    loadInFlight.current ??= loadFeed().finally(() => {
      loadInFlight.current = null;
    });
    return loadInFlight.current;
  }, [loadFeed]);

  useEffect(() => {
    void load();
    // Best-effort: the feed still renders whether or not this succeeds.
    void markAllBookingNotificationsRead().catch(() => undefined);
  }, [load]);

  useRealtimeStream(["booking_notifications_changed", "dispute_changed", "chat_unread_changed"], () => void load());

  if (items === null && !error) {
    return (
      <div className="flex justify-center py-12">
        <Spinner label="Loading notifications…" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl">
      {error ? <p className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        {!items || items.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-neutral-500">You&apos;re all caught up.</p>
        ) : (
          <ul>
            {items.map((item, index) => {
              const rowContent = (
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
                    {notificationKindLabel(item.kind)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-neutral-900">{item.title}</p>
                    {item.body ? <p className="mt-0.5 line-clamp-2 text-sm text-neutral-500">{item.body}</p> : null}
                    <p className="mt-1 text-xs text-neutral-400">{formatNotificationTimestamp(item.created_at)}</p>
                  </div>
                  {item.unread ? <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" /> : null}
                </div>
              );
              const key = `${item.notification_id ?? item.booking_id ?? "row"}-${index}`;
              return (
                <li key={key} className="border-b border-neutral-100 last:border-b-0">
                  {item.href ? (
                    <Link href={item.href} className="block px-4 py-3.5 transition hover:bg-neutral-50">
                      {rowContent}
                    </Link>
                  ) : (
                    <div className="px-4 py-3.5">{rowContent}</div>
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
