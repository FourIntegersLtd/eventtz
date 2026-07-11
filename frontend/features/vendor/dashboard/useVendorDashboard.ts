"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchVendorBookings, type VendorBookingListItem } from "@/lib/vendorBookingsApi";
import { fetchChatUnreadCount } from "@/lib/chatApi";
import { installVisibilityRefresh } from "@/lib/useVisibilityRefresh";
import { useRealtimeRefresh } from "@/lib/realtimeHooks";
import { fetchVendorBookingNotificationsUnreadCount } from "@/lib/vendorNotificationsApi";
import { fetchVendorNotificationsFeed, type NotificationFeedItem } from "@/lib/notificationsFeedApi";

function dateKeyFromIso(iso: string | null | undefined): string | null {
  if (!iso || iso.length < 10) return null;
  return iso.slice(0, 10);
}

function noonUtcSafeDateFromKey(key: string): Date {
  return new Date(`${key}T12:00:00`);
}

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

export type VendorBookingsByDate = Record<string, VendorBookingListItem[]>;

export type VendorDashboardState = {
  loadStatus: "loading" | "ready" | "error";
  activeBookingsCount: number;
  pendingBookingsCount: number;
  bookingNotificationsUnread: number;
  chatUnread: number;
  updates: NotificationFeedItem[];
  needsResponse: VendorBookingListItem[];
  activeBookings: VendorBookingListItem[];
  acceptedUpcoming: VendorBookingListItem[];
  upcomingAgenda: VendorBookingListItem[];
  bookingsByDate: VendorBookingsByDate;
  errorMessage: string | null;
};

const initial: VendorDashboardState = {
  loadStatus: "loading",
  activeBookingsCount: 0,
  pendingBookingsCount: 0,
  bookingNotificationsUnread: 0,
  chatUnread: 0,
  updates: [],
  needsResponse: [],
  activeBookings: [],
  acceptedUpcoming: [],
  upcomingAgenda: [],
  bookingsByDate: {},
  errorMessage: null,
};

export function useVendorDashboard(enabled: boolean) {
  const [state, setState] = useState<VendorDashboardState>(initial);

  const load = useCallback(async () => {
    if (!enabled) return;
    setState((s) => ({ ...s, loadStatus: "loading", errorMessage: null }));
    try {
      const [active, chatUnread, bookingNotificationsUnread, updates] = await Promise.all([
        fetchVendorBookings("active"),
        fetchChatUnreadCount(),
        fetchVendorBookingNotificationsUnreadCount(),
        fetchVendorNotificationsFeed(),
      ]);
      const pendingBookingsCount = active.filter((b) => b.status === "pending").length;
      const needsResponse = active.filter((b) => b.status === "pending").slice(0, 3);

      const todayKey = localDateKey(new Date());
      const todayAtNoon = noonUtcSafeDateFromKey(todayKey);

      const accepted = active.filter((b) => b.status === "accepted");
      const acceptedUpcoming = accepted.filter((b) => {
        const startKey = dateKeyFromIso(b.event_date);
        if (!startKey) return false;
        const start = noonUtcSafeDateFromKey(startKey);
        const endKey = dateKeyFromIso(b.event_end_date);
        const end = endKey ? noonUtcSafeDateFromKey(endKey) : start;
        return end.getTime() >= todayAtNoon.getTime();
      });

      const bookingsByDate: VendorBookingsByDate = {};
      for (const b of acceptedUpcoming) {
        const startKey = dateKeyFromIso(b.event_date);
        if (!startKey) continue;
        const start = noonUtcSafeDateFromKey(startKey);
        const endKey = dateKeyFromIso(b.event_end_date);
        const end = endKey ? noonUtcSafeDateFromKey(endKey) : start;

        for (let d = start; d.getTime() <= end.getTime(); d = addDays(d, 1)) {
          const key = localDateKey(d);
          if (noonUtcSafeDateFromKey(key).getTime() < todayAtNoon.getTime()) continue;
          (bookingsByDate[key] ??= []).push(b);
        }
      }

      const upcomingAgenda = [...acceptedUpcoming]
        .sort((a, b) => {
          const ak = dateKeyFromIso(a.event_date) ?? "9999-12-31";
          const bk = dateKeyFromIso(b.event_date) ?? "9999-12-31";
          return ak.localeCompare(bk);
        })
        .slice(0, 5);

      setState({
        loadStatus: "ready",
        activeBookingsCount: active.length,
        pendingBookingsCount,
        bookingNotificationsUnread,
        chatUnread,
        updates,
        needsResponse,
        activeBookings: active,
        acceptedUpcoming,
        upcomingAgenda,
        bookingsByDate,
        errorMessage: null,
      });
    } catch {
      setState({
        ...initial,
        loadStatus: "error",
        errorMessage: "We couldn't load your dashboard. Try refreshing the page.",
      });
    }
  }, [enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!enabled) return;
    return installVisibilityRefresh(() => {
      void load();
    });
  }, [enabled, load]);

  useRealtimeRefresh(
    ["bookings:refresh", "chat:unread_refresh", "booking_notifications:refresh", "disputes:refresh"],
    () => void load(),
    [enabled, load],
  );

  return { ...state, reload: load };
}
