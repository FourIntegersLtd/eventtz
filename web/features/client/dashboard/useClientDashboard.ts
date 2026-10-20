"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientBookingListItem } from "@/lib/clientBookingsApi";
import { fetchClientBookingNotificationsUnreadCount } from "@/lib/clientNotificationsApi";
import { fetchChatUnreadCount } from "@/lib/chatApi";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";
import { fetchClientDashboard } from "@/lib/portalDashboardApi";
import { installVisibilityRefresh } from "@/lib/useVisibilityRefresh";
import { useRealtimeRefresh } from "@/lib/realtimeHooks";
import type { NotificationFeedItem } from "@/lib/notificationsFeedApi";

export type ClientBookingsByDate = Record<string, ClientBookingListItem[]>;

export type ClientDashboardState = {
  loadStatus: "loading" | "ready" | "error";
  activeCount: number;
  completedCount: number;
  awaitingVendorCount: number;
  awaitingClientCount: number;
  bookingNotificationsUnread: number;
  chatUnread: number;
  nextBooking: ClientBookingListItem | null;
  updates: NotificationFeedItem[];
  activeBookings: ClientBookingListItem[];
  acceptedUpcoming: ClientBookingListItem[];
  upcomingAgenda: ClientBookingListItem[];
  bookingsByDate: ClientBookingsByDate;
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

export function useClientDashboard(enabled: boolean) {
  const [state, setState] = useState<ClientDashboardState>(initial);
  const dashboardViewedRef = useRef(false);

  const load = useCallback(async () => {
    if (!enabled) return;
    setState((s) => ({ ...s, loadStatus: "loading", errorMessage: null }));
    try {
      const [dashboard, bookingNotificationsUnread, chatUnread] = await Promise.all([
        fetchClientDashboard(),
        fetchClientBookingNotificationsUnreadCount(),
        fetchChatUnreadCount(),
      ]);

      const acceptedUpcoming = Object.values(dashboard.bookings_by_date).flat();
      const uniqueAccepted = [
        ...new Map(acceptedUpcoming.map((booking) => [booking.booking_request_id, booking])).values(),
      ];

      if (!dashboardViewedRef.current) {
        dashboardViewedRef.current = true;
        track(MixpanelEvents.client_dashboard_viewed, {
          active_count: dashboard.active_count,
          awaiting_vendor_count: dashboard.awaiting_vendor_count,
          awaiting_client_count: dashboard.awaiting_client_count,
        });
      }

      setState({
        loadStatus: "ready",
        activeCount: dashboard.active_count,
        completedCount: dashboard.completed_count,
        awaitingVendorCount: dashboard.awaiting_vendor_count,
        awaitingClientCount: dashboard.awaiting_client_count,
        bookingNotificationsUnread,
        chatUnread,
        nextBooking: dashboard.next_booking,
        updates: dashboard.notification_preview.items ?? [],
        activeBookings: dashboard.active_bookings,
        acceptedUpcoming: uniqueAccepted,
        upcomingAgenda: dashboard.upcoming_agenda,
        bookingsByDate: dashboard.bookings_by_date,
        needsReview: dashboard.needs_review,
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

  useRealtimeRefresh(["booking_notifications:refresh", "chat:unread_refresh"], load, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    return installVisibilityRefresh(load);
  }, [enabled, load]);

  return { state, reload: load };
}
