"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { fetchChatUnreadCount } from "@/lib/chatApi";
import { installVisibilityRefresh } from "@/lib/useVisibilityRefresh";
import { useRealtimeRefresh } from "@/lib/realtimeHooks";
import { fetchVendorBookingNotificationsUnreadCount } from "@/lib/vendorNotificationsApi";
import type { NotificationFeedItem } from "@/lib/notificationsFeedApi";
import { fetchVendorDashboard } from "@/lib/portalDashboardApi";
import { fetchVendorProfile, type VendorProfileResponse } from "@/lib/vendorProfileApi";
import {
  fetchVendorStripeConnectStatus,
  postConnectStripeAccount,
  type VendorPaymentsStatus,
} from "@/lib/vendorPaymentsApi";
import { isVendorPayoutsReady } from "@/features/vendor/payments/useVendorPayoutsReady";
import { getApiErrorDetail } from "@/lib/api-errors";
import { fetchVendorAnalytics, type VendorAnalytics } from "@/lib/vendorAnalyticsApi";
import type { VendorBookingListItem } from "@/lib/vendorBookingsApi";

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
  payoutsReady: boolean | null;
  cancellationPolicyChosen: boolean | null;
  analytics: VendorAnalytics | null;
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
  payoutsReady: null,
  cancellationPolicyChosen: null,
  analytics: null,
};

/** Whether an approved vendor's form holds a preset; `null` for a draft or unloaded profile (no nudge). */
export function cancellationPolicyChosenFor(
  profile: Pick<VendorProfileResponse, "approval_status" | "profile_form_data"> | null,
): boolean | null {
  if (!profile || profile.approval_status !== "approved") return null;
  return typeof profile.profile_form_data.cancellationPolicy === "string";
}

export function useVendorDashboard(enabled: boolean) {
  const { showToast } = useToast();
  const [state, setState] = useState<VendorDashboardState>(initial);
  const [payoutsConnecting, setPayoutsConnecting] = useState(false);

  const connectPayouts = useCallback(async (returnPath: string) => {
    setPayoutsConnecting(true);
    try {
      const { onboarding_url } = await postConnectStripeAccount(returnPath);
      window.location.href = onboarding_url;
    } catch (e: unknown) {
      setPayoutsConnecting(false);
      const message = getApiErrorDetail(e) ?? "Could not start payout setup. Try again.";
      showToast({ title: "Payout setup failed", description: message, tone: "error" });
    }
  }, [showToast]);

  const load = useCallback(async () => {
    if (!enabled) return;
    setState((s) => ({ ...s, loadStatus: "loading", errorMessage: null }));
    try {
      const [dashboard, chatUnread, bookingNotificationsUnread, paymentsStatus, profile, analytics] =
        await Promise.all([
          fetchVendorDashboard(),
          fetchChatUnreadCount(),
          fetchVendorBookingNotificationsUnreadCount(),
          fetchVendorStripeConnectStatus().catch((): VendorPaymentsStatus | null => null),
          fetchVendorProfile().catch((): VendorProfileResponse | null => null),
          fetchVendorAnalytics(90).catch((): VendorAnalytics | null => null),
        ]);

      const acceptedUpcoming = Object.values(dashboard.bookings_by_date).flat();
      const uniqueAccepted = [
        ...new Map(acceptedUpcoming.map((booking) => [booking.booking_request_id, booking])).values(),
      ];

      setState({
        loadStatus: "ready",
        activeBookingsCount: dashboard.active_bookings_count,
        pendingBookingsCount: dashboard.pending_bookings_count,
        bookingNotificationsUnread,
        chatUnread,
        updates: dashboard.notification_preview.items ?? [],
        needsResponse: dashboard.needs_response,
        activeBookings: dashboard.active_bookings,
        acceptedUpcoming: uniqueAccepted,
        upcomingAgenda: dashboard.upcoming_agenda,
        bookingsByDate: dashboard.bookings_by_date,
        errorMessage: null,
        payoutsReady: paymentsStatus ? isVendorPayoutsReady(paymentsStatus) : null,
        cancellationPolicyChosen: cancellationPolicyChosenFor(profile),
        analytics,
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

  return { ...state, payoutsConnecting, connectPayouts, reload: load };
}
