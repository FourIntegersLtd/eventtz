"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { resolveWasClientTotalLabel } from "@/features/bookings/bookingPriceLabels";
import { getApiErrorDetail, postBookingCheckoutSync } from "@/lib/bookingCheckoutApi";
import {
  fetchClientBookingDetail,
  fetchClientBookings,
  patchClientBookingStatus,
  postCancelClientBooking,
  postClientConfirmCompletion,
  type ClientBookingDetail,
} from "@/lib/clientBookingsApi";
import type { BookingDetailAction } from "@/features/bookings/bookingViewModel";
import {
  toClientBookingDetailViewModel,
  toClientBookingRowViewModel,
} from "@/features/client/bookings/clientBookingViewModel";
import { groupBookingsByEvent } from "@/features/bookings/groupBookingsByEvent";
import {
  BOOKING_NOTIFICATIONS_CLEARED_EVENT,
  markAllClientBookingNotificationsRead,
} from "@/lib/clientNotificationsApi";
import { useParticipantBookingsScaffold } from "@/features/bookings/useParticipantBookingsScaffold";
import {
  BOOKING_CONFIRM_COPY,
  PAYMENT_FLOW_COPY,
} from "@/features/bookings/bookingConfirmCopy";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";

type UseClientBookingsControllerArgs = {
  selectedBookingId?: string;
};

export function useClientBookingsController({ selectedBookingId }: UseClientBookingsControllerArgs) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
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

  const [actionBusy, setActionBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [declineQuoteOpen, setDeclineQuoteOpen] = useState(false);
  const [declinePriceOpen, setDeclinePriceOpen] = useState(false);
  const [pendingQuoteAction, setPendingQuoteAction] = useState<null | "accept" | "decline">(null);
  const [pendingPriceAction, setPendingPriceAction] = useState<null | "accept" | "decline">(null);
  const paymentBannerRef = useRef<HTMLDivElement>(null);
  const pendingPaymentSyncRef = useRef<string | null>(null);
  const checkoutReturnSyncRef = useRef<string | null>(null);
  const detailViewedRef = useRef<string | null>(null);
  const paymentTrackedRef = useRef<string | null>(null);
  const paymentDue =
    detail?.booking_status === "accepted" &&
    (detail?.payment_status === "unpaid" || detail?.payment_status === "pending");

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
    if (paymentDue) {
      paymentBannerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [paymentDue, detail?.booking_request_id]);

  useEffect(() => {
    pendingPaymentSyncRef.current = null;
    checkoutReturnSyncRef.current = null;
    paymentTrackedRef.current = null;
  }, [selectedBookingId]);

  useEffect(() => {
    if (!selectedBookingId || detail?.payment_status !== "pending") return;
    if (pendingPaymentSyncRef.current === selectedBookingId) return;
    pendingPaymentSyncRef.current = selectedBookingId;
    void postBookingCheckoutSync(selectedBookingId)
      .then(() => fetchClientBookingDetail(selectedBookingId))
      .then((booking) => {
        if (booking.payment_status === "paid" || booking.payment_status === "payout_released") {
          setDetail(booking);
          bumpDetail();
        }
      })
      .catch(() => {
        /* webhook may still be in flight, or checkout was abandoned */
      });
  }, [selectedBookingId, detail?.payment_status, bumpDetail, setDetail]);

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

  const confirmCancelBooking = async () => {
    if (!detail?.booking_request_id) return;
    const bookingId = detail.booking_request_id;
    setActionError(null);
    setActionBusy(true);
    try {
      await postCancelClientBooking(bookingId);
      track(MixpanelEvents.booking_cancelled, { booking_id: bookingId });
      showToast({ title: "Booking cancelled", tone: "success" });
      setCancelOpen(false);
      bumpDetail();
    } catch (e: unknown) {
      setActionError(getApiErrorDetail(e) ?? "Could not cancel this booking.");
    } finally {
      setActionBusy(false);
    }
  };

  const applyClientQuoteResponse = async (next: "accepted" | "declined") => {
    if (!detail?.booking_request_id) return;
    if (detail.initiator !== "vendor" || detail.booking_status !== "pending") return;
    const bookingId = detail.booking_request_id;
    setActionError(null);
    setActionBusy(true);
    setPendingQuoteAction(next === "accepted" ? "accept" : "decline");
    try {
      await patchClientBookingStatus(bookingId, next);
      track(
        next === "accepted"
          ? MixpanelEvents.booking_quote_accepted
          : MixpanelEvents.booking_quote_declined,
        { booking_id: bookingId },
      );
      showToast({
        title: next === "accepted" ? "Quote accepted" : "Quote declined",
        tone: "success",
      });
      bumpDetail();
    } catch (e: unknown) {
      setActionError(getApiErrorDetail(e) ?? "Could not update this quote.");
    } finally {
      setActionBusy(false);
      setPendingQuoteAction(null);
    }
  };

  const applyClientUpdatedPriceResponse = async (next: "accepted" | "declined") => {
    if (!detail?.booking_request_id) return;
    if (detail.initiator !== "client" || detail.booking_status !== "pending") return;
    if (detail.vendor_adjustments.length === 0) return;
    const bookingId = detail.booking_request_id;
    setActionError(null);
    setActionBusy(true);
    setPendingPriceAction(next === "accepted" ? "accept" : "decline");
    try {
      await patchClientBookingStatus(bookingId, next);
      track(
        next === "accepted"
          ? MixpanelEvents.booking_price_update_accepted
          : MixpanelEvents.booking_price_update_declined,
        { booking_id: bookingId },
      );
      showToast({
        title: next === "accepted" ? "Price update accepted" : "Price update declined",
        tone: "success",
      });
      bumpDetail();
    } catch (e: unknown) {
      setActionError(getApiErrorDetail(e) ?? "Could not update this booking.");
    } finally {
      setActionBusy(false);
      setPendingPriceAction(null);
    }
  };

  const [confirmingCompletion, setConfirmingCompletion] = useState(false);
  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false);
  const confirmCompletion = async () => {
    if (!detail?.booking_request_id) return;
    const bookingId = detail.booking_request_id;
    setActionError(null);
    setConfirmingCompletion(true);
    try {
      await postClientConfirmCompletion(bookingId);
      track(MixpanelEvents.booking_completed, { booking_id: bookingId });
      showToast({ title: "Completion confirmed", tone: "success" });
      setConfirmCompleteOpen(false);
      bumpDetail();
    } catch (e: unknown) {
      setActionError(getApiErrorDetail(e) ?? "Could not confirm completion.");
    } finally {
      setConfirmingCompletion(false);
    }
  };

  const paymentBanner = searchParams.get("payment");
  const checkoutSessionId = searchParams.get("session_id");
  const [paymentSyncError, setPaymentSyncError] = useState<string | null>(null);

  const paymentConfirmed =
    detail?.payment_status === "paid" || detail?.payment_status === "payout_released";

  useEffect(() => {
    if (!selectedBookingId || !paymentBanner) return;
    const key = `${selectedBookingId}:${paymentBanner}`;
    if (paymentTrackedRef.current === key) return;
    if (paymentBanner === "cancelled") {
      paymentTrackedRef.current = key;
      track(MixpanelEvents.booking_payment_cancelled, { booking_id: selectedBookingId });
      return;
    }
    if (paymentBanner === "success" && paymentConfirmed) {
      paymentTrackedRef.current = key;
      track(MixpanelEvents.booking_payment_succeeded, { booking_id: selectedBookingId });
    }
  }, [selectedBookingId, paymentBanner, paymentConfirmed]);

  useEffect(() => {
    if (!selectedBookingId || paymentBanner !== "success") return;
    if (!paymentConfirmed) return;
    router.replace(`/client/bookings/${encodeURIComponent(selectedBookingId)}`, {
      scroll: false,
    });
  }, [selectedBookingId, paymentBanner, paymentConfirmed, router]);

  useEffect(() => {
    if (!selectedBookingId || paymentBanner !== "success") return;
    if (paymentConfirmed) return;

    const syncKey = `${selectedBookingId}:${checkoutSessionId ?? ""}`;
    if (checkoutReturnSyncRef.current === syncKey) return;
    checkoutReturnSyncRef.current = syncKey;

    let cancelled = false;
    setPaymentSyncError(null);
    void postBookingCheckoutSync(selectedBookingId, checkoutSessionId)
      .then(() => fetchClientBookingDetail(selectedBookingId))
      .then((booking) => {
        if (cancelled) return;
        setDetail(booking);
        bumpDetail();
        router.replace(`/client/bookings/${encodeURIComponent(selectedBookingId)}`, {
          scroll: false,
        });
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setPaymentSyncError(
            getApiErrorDetail(e) ??
              "Payment went through. Refresh in a moment if it doesn't update.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    selectedBookingId,
    paymentBanner,
    checkoutSessionId,
    paymentConfirmed,
    router,
    setDetail,
    bumpDetail,
  ]);

  const showCheckoutReturnBanner =
    paymentBanner === "success" || paymentBanner === "cancelled";
  const checkoutReturnMessage =
    paymentBanner === "cancelled"
      ? "Payment cancelled. Try again when you're ready."
      : paymentSyncError
        ? paymentSyncError
        : paymentConfirmed
          ? PAYMENT_FLOW_COPY.paymentSuccess
          : "Confirming your payment…";

  const rows = useMemo(() => list.map(toClientBookingRowViewModel), [list]);
  const listItemsById = useMemo(
    () => new Map(list.map((item) => [item.booking_request_id, item])),
    [list],
  );
  const eventGroups = useMemo(() => {
    if (tab !== "active" || rows.length === 0) return null;
    const groups = groupBookingsByEvent(rows, listItemsById);
    return groups.length > 1 || groups.some((g) => g.eventId) ? groups : null;
  }, [tab, rows, listItemsById]);
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
    paymentDue,
    paymentBannerRef,
    showCancelledRefunded,
    selectBooking,
    payNow,
  };
}
