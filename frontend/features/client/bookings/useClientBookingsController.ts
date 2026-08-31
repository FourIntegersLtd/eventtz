"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  fetchClientBookingDetail,
  fetchClientBookings,
  type ClientBookingDetail,
} from "@/lib/clientBookingsApi";
import type { BookingDetailAction } from "@/features/bookings/bookingViewModel";
import {
  toClientBookingDetailViewModel,
  toClientBookingRowViewModel,
} from "@/features/client/bookings/clientBookingViewModel";
import { bookingEventGroupsForList } from "@/features/bookings/groupBookingsByEvent";
import {
  BOOKING_NOTIFICATIONS_CLEARED_EVENT,
  markAllClientBookingNotificationsRead,
} from "@/lib/clientNotificationsApi";
import { useParticipantBookingsScaffold } from "@/features/bookings/useParticipantBookingsScaffold";
import { BOOKING_CONFIRM_COPY } from "@/features/bookings/bookingConfirmCopy";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";
import { useClientBookingActions } from "@/features/client/bookings/useClientBookingActions";
import { useClientBookingPaymentReturn } from "@/features/client/bookings/useClientBookingPaymentReturn";

type UseClientBookingsControllerArgs = {
  selectedBookingId?: string;
};

export function useClientBookingsController({ selectedBookingId }: UseClientBookingsControllerArgs) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rateParam = Number(searchParams.get("rate") ?? "");
  const deepLinkRating = rateParam >= 1 && rateParam <= 5 ? rateParam : undefined;
  const listStatusFilter = searchParams.get("status") ?? "";
  const urlTab = searchParams.get("tab");

  const fetchList = useCallback(
    (t: "active" | "closed") =>
      fetchClientBookings({
        group: t,
        ...(listStatusFilter === "pending" ? { status: "pending" } : {}),
      }),
    [listStatusFilter],
  );
  const fetchDetail = useCallback((id: string) => fetchClientBookingDetail(id), []);
  const getDetailStatus = useCallback((b: ClientBookingDetail) => b.booking_status, []);

  const {
    tab,
    setTab,
    list,
    listLoading,
    listError,
    detail,
    setDetail,
    detailLoading,
    detailError,
    bumpDetail,
    actionError,
    setActionError,
    chatOpen,
    setChatOpen,
  } = useParticipantBookingsScaffold({
    selectedBookingId,
    fetchList,
    fetchDetail,
    getDetailStatus,
  });

  useEffect(() => {
    if (urlTab === "active" || urlTab === "closed") {
      setTab(urlTab);
    }
  }, [urlTab, setTab]);

  const detailViewedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!detail?.booking_request_id || detailLoading) return;
    if (detailViewedRef.current === detail.booking_request_id) return;
    detailViewedRef.current = detail.booking_request_id;
    track(MixpanelEvents.booking_detail_viewed, {
      booking_id: detail.booking_request_id,
      status: detail.booking_status,
    });
  }, [detail?.booking_request_id, detail?.booking_status, detailLoading]);

  useEffect(() => {
    void markAllClientBookingNotificationsRead()
      .then(() => {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent(BOOKING_NOTIFICATIONS_CLEARED_EVENT));
        }
      })
      .catch(() => {
        /* ignore - sidebar badge will refresh on nav/focus/SSE */
      });
  }, []);

  const {
    actionBusy,
    cancelOpen,
    setCancelOpen,
    declineQuoteOpen,
    setDeclineQuoteOpen,
    declinePriceOpen,
    setDeclinePriceOpen,
    pendingQuoteAction,
    pendingPriceAction,
    confirmingCompletion,
    confirmCompleteOpen,
    setConfirmCompleteOpen,
    confirmCancelBooking,
    confirmCompletion,
    applyClientQuoteResponse,
    applyClientUpdatedPriceResponse,
  } = useClientBookingActions({ detail, bumpDetail, setActionError });

  const {
    paymentBanner,
    paymentSyncError,
    paymentConfirmed,
    paymentDue,
    paymentBannerRef,
    showCheckoutReturnBanner,
    checkoutReturnMessage,
  } = useClientBookingPaymentReturn({
    selectedBookingId,
    detail,
    setDetail,
    bumpDetail,
  });

  const rows = useMemo(() => list.map(toClientBookingRowViewModel), [list]);
  const listItemsById = useMemo(
    () => new Map(list.map((item) => [item.booking_request_id, item])),
    [list],
  );
  const eventGroups = useMemo(
    () => bookingEventGroupsForList(rows, listItemsById, "vendor", tab === "active"),
    [tab, rows, listItemsById],
  );
  const viewModel = detail
    ? toClientBookingDetailViewModel(detail, () => setChatOpen(true))
    : null;

  const showUpdatedPriceBanner =
    detail?.booking_status === "pending" &&
    detail.initiator === "client" &&
    detail.vendor_adjustments.length > 0;

  const clientCancelCopy =
    detail?.payment_status === "paid"
      ? BOOKING_CONFIRM_COPY.cancelClientPaid
      : BOOKING_CONFIRM_COPY.cancelClient;

  const showCancelledRefunded =
    detail?.booking_status === "cancelled" &&
    (detail.payment_status === "refunded" || detail.payment_status === "partially_refunded");

  const footerActions: BookingDetailAction[] = [];
  const canCancel =
    detail &&
    (detail.booking_status === "pending" || detail.booking_status === "accepted") &&
    detail.payment_status !== "payout_released" &&
    !(detail.initiator === "vendor" && detail.booking_status === "pending");
  if (canCancel) {
    footerActions.push({
      key: "cancel",
      label: "Cancel booking",
      variant: "destructive",
      disabled: actionBusy,
      onClick: () => {
        setActionError(null);
        setCancelOpen(true);
      },
    });
    if (detail.booking_status === "accepted" && detail.payment_status === "paid") {
      if (!detail.client_completion_confirmed_at) {
        footerActions.push({
          key: "confirm-completion",
          label: "Confirm event complete",
          loadingLabel: "Confirming…",
          variant: "primary",
          disabled: actionBusy,
          loading: confirmingCompletion,
          onClick: () => setConfirmCompleteOpen(true),
        });
      }
    }
  }

  const headerActions: BookingDetailAction[] = [];
  if (detail && detail.initiator === "vendor" && detail.booking_status === "pending") {
    headerActions.push(
      {
        key: "accept",
        label: "Accept quote",
        loadingLabel: "Accepting…",
        variant: "primary",
        disabled: actionBusy,
        loading: pendingQuoteAction === "accept",
        onClick: () => void applyClientQuoteResponse("accepted"),
      },
      {
        key: "decline",
        label: "Decline",
        loadingLabel: "Declining…",
        variant: "destructive",
        disabled: actionBusy,
        loading: pendingQuoteAction === "decline",
        onClick: () => setDeclineQuoteOpen(true),
      },
    );
  }

  const selectBooking = useCallback(
    (id: string) => router.push(`/client/bookings/${id}`),
    [router],
  );

  const payNow = useCallback(() => {
    if (!detail?.booking_request_id) return;
    router.push(`/client/bookings/${detail.booking_request_id}/pay`);
  }, [detail?.booking_request_id, router]);

  return {
    router,
    selectedBookingId,
    deepLinkRating,
    tab,
    setTab,
    list,
    listLoading,
    listError,
    detail,
    setDetail,
    detailLoading,
    detailError,
    actionError,
    chatOpen,
    setChatOpen,
    rows,
    eventGroups,
    viewModel,
    headerActions,
    footerActions,
    actionBusy,
    cancelOpen,
    setCancelOpen,
    confirmCompleteOpen,
    setConfirmCompleteOpen,
    declineQuoteOpen,
    setDeclineQuoteOpen,
    declinePriceOpen,
    setDeclinePriceOpen,
    pendingPriceAction,
    pendingQuoteAction,
    confirmingCompletion,
    clientCancelCopy,
    confirmCancelBooking,
    confirmCompletion,
    applyClientQuoteResponse,
    applyClientUpdatedPriceResponse,
    showUpdatedPriceBanner,
    showCheckoutReturnBanner,
    checkoutReturnMessage,
    paymentBanner,
    paymentSyncError,
    paymentConfirmed,
    paymentDue,
    paymentBannerRef,
    showCancelledRefunded,
    selectBooking,
    payNow,
  };
}
