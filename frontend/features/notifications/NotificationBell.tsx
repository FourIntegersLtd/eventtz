"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  fetchClientNotificationsFeed,
  fetchVendorNotificationsFeed,
  type NotificationFeedItem,
} from "@/lib/notificationsFeedApi";
import { markAllClientBookingNotificationsRead } from "@/lib/clientNotificationsApi";
import { markAllVendorBookingNotificationsRead } from "@/lib/vendorNotificationsApi";
import { SHADOW, RADIUS, FOCUS_RING, TOUCH_TARGET } from "@/components/ui/tokens";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonListRows } from "@/components/ui/Skeleton";

export type NotificationBellProps = {
  portal: "client" | "vendor";
  /** Total unread count shown on the bell badge — computed once by PortalShell so it never disagrees with the sidebar badges. */
  unreadCount: number;
  /** Called after the dropdown marks booking notifications read, so PortalShell can refresh its own badge state. */
  onMarkedRead?: () => void;
};

const NOTIFICATIONS_HREF: Record<"client" | "vendor", string> = {
  client: "/client/notifications",
  vendor: "/vendor/notifications",
};

/**
 * Top-bar bell + dropdown. Opening the dropdown is the explicit, visible
 * "mark as read" action for booking notifications — replacing the previous
 * silent auto-mark-read-on-page-visit side effect.
 */
export function NotificationBell({ portal, unreadCount, onMarkedRead }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationFeedItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onClickOutside);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const fetchFeed = portal === "client" ? fetchClientNotificationsFeed : fetchVendorNotificationsFeed;
    const markAllRead =
      portal === "client" ? markAllClientBookingNotificationsRead : markAllVendorBookingNotificationsRead;
    void (async () => {
      try {
        const feed = await fetchFeed();
        if (!cancelled) setItems(feed);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
      try {
        await markAllRead();
        onMarkedRead?.();
      } catch {
        // best-effort — dropdown already showed the items either way
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, portal, onMarkedRead]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`relative inline-flex items-center justify-center rounded-lg text-neutral-600 transition duration-150 ease-out hover:bg-neutral-100 active:scale-95 ${TOUCH_TARGET} ${FOCUS_RING}`}
      >
        <Bell className="h-5 w-5" aria-hidden />
        {unreadCount > 0 ? (
          <span
            className="absolute -right-0.5 -top-0.5 min-w-[1.1rem] rounded-full bg-primary px-1 text-center text-[10px] font-bold leading-[1.1rem] text-white"
            aria-hidden
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className={`absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] animate-ui-fade-in border border-neutral-200 bg-white ${RADIUS.md} ${SHADOW.overlay}`}
        >
          <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
            <p className="text-sm font-semibold text-neutral-900">Notifications</p>
            <Link
              href={NOTIFICATIONS_HREF[portal]}
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-primary hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="scroll-pane max-h-96 p-2">
            {loading ? (
              <div className="p-2">
                <SkeletonListRows rows={3} />
              </div>
            ) : !items || items.length === 0 ? (
              <EmptyState
                title="You're all caught up"
                className="border-none py-6"
              />
            ) : (
              <ul className="space-y-1">
                {items.slice(0, 8).map((item, i) => {
                  const content = (
                    <>
                      <p className="truncate text-sm font-medium text-neutral-900">{item.title}</p>
                      {item.body ? (
                        <p className="mt-0.5 line-clamp-2 text-xs text-neutral-500">{item.body}</p>
                      ) : null}
                    </>
                  );
                  return (
                    <li key={`${item.notification_id ?? item.booking_id ?? i}-${i}`}>
                      {item.href ? (
                        <Link
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className="block rounded-lg px-3 py-2 transition duration-150 ease-out hover:bg-neutral-50"
                        >
                          {content}
                        </Link>
                      ) : (
                        <div className="rounded-lg px-3 py-2">{content}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
