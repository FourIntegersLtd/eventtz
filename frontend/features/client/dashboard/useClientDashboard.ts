"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchClientBookings, type ClientBookingListItem } from "@/lib/clientBookingsApi";
import { BOOKING_NOTIFICATIONS_REFRESH_EVENT, fetchClientBookingNotificationsUnreadCount } from "@/lib/clientNotificationsApi";
import { CHAT_UNREAD_CLEARED_EVENT, fetchChatUnreadCount } from "@/lib/chatApi";
import { installVisibilityRefresh } from "@/lib/useVisibilityRefresh";
import { useRealtimeRefresh } from "@/lib/realtimeHooks";
import { fetchClientNotificationsFeed, type NotificationFeedItem } from "@/lib/notificationsFeedApi";

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

export type ClientBookingsByDate = Record<string, ClientBookingListItem[]>;

export type ClientDashboardState = {
  loadStatus: "loading" | "ready" | "error";
  activeCount: number;
  completedCount: number;
  /** Client-initiated requests still waiting on the vendor to accept/decline/quote. */
  awaitingVendorCount: number;
  /** Vendor-sent quotes waiting on the client to accept — a distinct, more urgent bucket. */
  awaitingClientCount: number;
  bookingNotificationsUnread: number;
  chatUnread: number;
  nextBooking: ClientBookingListItem | null;
  updates: NotificationFeedItem[];
  activeBookings: ClientBookingListItem[];
  acceptedUpcoming: ClientBookingListItem[];
  upcomingAgenda: ClientBookingListItem[];
  bookingsByDate: ClientBookingsByDate;
  /** Completed bookings with no review yet — powers the one-tap review nudge. */
  needsReview: ClientBookingListItem[];
  errorMessage: string | null;
};

const initial: ClientDashboardState = {
  loadStatus: "loading",
  activeCount: 0,
  completedCount: 0,
  awaitingVendorCount: 0,
  awaitingClientCount: 0,
  bookingNotificationsUnread: 0,
  chatUnread: 0,
  nextBooking: null,
  updates: [],
  activeBookings: [],
  acceptedUpcoming: [],
  upcomingAgenda: [],
  bookingsByDate: {},
  needsReview: [],
  errorMessage: null,
};

function pickNextUpcoming(active: ClientBookingListItem[]): ClientBookingListItem | null {
  if (active.length === 0) return null;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const withTime = active.map((b) => ({
    b,
    t: Date.parse(`${b.event_date.slice(0, 10)}T12:00:00`),
  }));
  const future = withTime
    .filter(({ t }) => !Number.isNaN(t) && t >= startOfToday.getTime())
    .sort((a, b) => a.t - b.t);
  if (future.length > 0) return future[0].b;
  const sorted = [...withTime].filter(({ t }) => !Number.isNaN(t)).sort((a, b) => a.t - b.t);
  return sorted[0]?.b ?? null;
}

export function useClientDashboard(enabled: boolean) {
  const [state, setState] = useState<ClientDashboardState>(initial);

  const load = useCallback(async () => {
    if (!enabled) return;
    setState((s) => ({ ...s, loadStatus: "loading", errorMessage: null }));
    try {
      const [active, completed, bookingNotificationsUnread, chatUnread, updates] = await Promise.all([
        fetchClientBookings("active"),
        fetchClientBookings("completed"),
        fetchClientBookingNotificationsUnreadCount(),
        fetchChatUnreadCount(),
        fetchClientNotificationsFeed(),
      ]);

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

      const bookingsByDate: ClientBookingsByDate = {};
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

      const awaitingVendorCount = active.filter(
        (b) => b.status === "pending" && b.initiator !== "vendor",
      ).length;
      const awaitingClientCount = active.filter(
        (b) => b.status === "pending" && b.initiator === "vendor",
      ).length;

      setState({
        loadStatus: "ready",
        activeCount: active.length,
        completedCount: completed.length,
        awaitingVendorCount,
        awaitingClientCount,
        bookingNotificationsUnread,
        chatUnread,
        nextBooking: pickNextUpcoming(active),
        updates,
        activeBookings: active,
        acceptedUpcoming,
        upcomingAgenda,
        bookingsByDate,
        needsReview: completed.filter((b) => !b.has_review),
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
