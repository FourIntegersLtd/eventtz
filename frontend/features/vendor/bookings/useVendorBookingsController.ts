"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getApiErrorDetail } from "@/lib/api-errors";
import type { BookingDetailAction } from "@/features/bookings/bookingViewModel";
import { useParticipantBookingsScaffold } from "@/features/bookings/useParticipantBookingsScaffold";
import {
  BOOKING_CONFIRM_COPY,
} from "@/features/bookings/bookingConfirmCopy";
import {
  clearPendingAcceptBookingId,
  getPendingAcceptBookingId,
  setPendingAcceptBookingId,
} from "@/features/vendor/payments/payoutAcceptIntent";
import {
  isVendorPayoutsReady,
  useVendorPayoutsReady,
} from "@/features/vendor/payments/useVendorPayoutsReady";
import {
  fetchVendorBookingDetail,
  fetchVendorBookings,
  patchVendorBookingStatus,
  postVendorConfirmCompletion,
  putVendorBookingAdjustments,
  type VendorBookingDetail,
} from "@/lib/vendorBookingsApi";
import {
  toVendorBookingDetailViewModel,
  toVendorBookingRowViewModel,
} from "@/features/vendor/bookings/vendorBookingViewModel";
import type { AdjDraftRow } from "@/features/vendor/bookings/vendorBookingResponseHelpers";

type UseVendorBookingsControllerArgs = {
  selectedBookingId?: string;
};

export function useVendorBookingsController({ selectedBookingId }: UseVendorBookingsControllerArgs) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const listStatusFilter = searchParams.get("status") ?? "";
  const urlTab = searchParams.get("tab");

  const fetchList = useCallback(
    (t: "active" | "closed") =>
      fetchVendorBookings({
        group: t,
        ...(listStatusFilter === "pending" ? { status: "pending" } : {}),
      }),
    [listStatusFilter],
  );
  const fetchDetail = useCallback((id: string) => fetchVendorBookingDetail(id), []);
  const getDetailStatus = useCallback((b: VendorBookingDetail) => b.status, []);

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
  const [pendingAction, setPendingAction] = useState<
    null | "accept" | "decline" | "complete" | "vendor_cancel" | "withdraw"
  >(null);
  const [adjSaving, setAdjSaving] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | "withdraw" | "vendor_cancel" | "complete">(
    null,
  );
  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const resumeAcceptHandled = useRef(false);

  const {
    payoutsReady,
    loading: payoutsLoading,
    connecting: connectingPayouts,
    error: payoutConnectError,
    setError: setPayoutConnectError,
    refresh: refreshPayouts,
    connectPayouts,
  } = useVendorPayoutsReady(true);

  const applyBookingStatus = useCallback(
    async (next: "accepted" | "declined", bookingId?: string) => {
      const id = bookingId ?? detail?.id;
      if (!id) return;
      if (detail && detail.id === id && detail.initiator === "vendor") return;
      if (next === "declined" && detail && detail.id === id && detail.status !== "pending") return;
      if (
        next === "accepted" &&
        detail &&
        detail.id === id &&
        detail.status !== "pending" &&
        detail.status !== "declined"
      ) {
        return;
      }
      setActionError(null);
      setActionBusy(true);
      setPendingAction(next === "accepted" ? "accept" : "decline");
      try {
        await patchVendorBookingStatus(id, next);
        clearPendingAcceptBookingId();
        setPayoutModalOpen(false);
        bumpDetail();
      } catch (e: unknown) {
        const msg = getApiErrorDetail(e) ?? "Could not update this booking.";
        if (next === "accepted" && msg.toLowerCase().includes("payout setup")) {
          setPayoutModalOpen(true);
          setActionError(null);
        } else {
          setActionError(msg);
        }
      } finally {
        setActionBusy(false);
        setPendingAction(null);
      }
    },
    [detail, bumpDetail, setActionError],
  );

  const requestAccept = useCallback(() => {
    if (!detail?.id) return;
    if (payoutsLoading) return;
    if (!payoutsReady) {
      setPayoutModalOpen(true);
      return;
    }
    void applyBookingStatus("accepted");
  }, [detail?.id, payoutsLoading, payoutsReady, applyBookingStatus]);

  const onCompletePayoutSetup = useCallback(() => {
    if (!detail?.id) return;
    setPendingAcceptBookingId(detail.id);
    void connectPayouts(`/vendor/bookings/${detail.id}`);
  }, [detail?.id, connectPayouts]);

  useEffect(() => {
    const stripeParam = searchParams.get("stripe");
    if (stripeParam !== "return" && stripeParam !== "refresh") return;
    if (!selectedBookingId) return;
    if (resumeAcceptHandled.current) return;
    resumeAcceptHandled.current = true;

    const params = new URLSearchParams(searchParams.toString());
    params.delete("stripe");
    const next = params.toString();
    router.replace(
      next ? `/vendor/bookings/${selectedBookingId}?${next}` : `/vendor/bookings/${selectedBookingId}`,
    );

    void (async () => {
      const status = await refreshPayouts();
      const pendingId = getPendingAcceptBookingId();
      const ready = isVendorPayoutsReady(status);
      if (stripeParam === "return" && pendingId === selectedBookingId && ready) {
        await applyBookingStatus("accepted", selectedBookingId);
        return;
      }
      if (pendingId === selectedBookingId && !ready) {
        setPayoutModalOpen(true);
        setPayoutConnectError(
          stripeParam === "refresh"
            ? "Payout setup was interrupted. Continue to finish."
            : "Finish payout setup to accept this booking.",
        );
      }
    })();
  }, [
    searchParams,
    selectedBookingId,
    router,
    refreshPayouts,
    applyBookingStatus,
    setPayoutConnectError,
  ]);

  const applyWithdrawVendorQuote = async () => {
    if (!detail?.id || detail.status !== "pending" || detail.initiator !== "vendor") return;
    setActionError(null);
    setActionBusy(true);
    setPendingAction("withdraw");
    try {
      await patchVendorBookingStatus(detail.id, "cancelled");
      bumpDetail();
    } catch (e: unknown) {
      setActionError(getApiErrorDetail(e) ?? "Could not withdraw this quote.");
    } finally {
      setActionBusy(false);
      setPendingAction(null);
    }
  };

  const applyVendorCancel = async () => {
    if (!detail?.id || detail.status !== "accepted") return;
    setActionError(null);
    setActionBusy(true);
    setPendingAction("vendor_cancel");
    try {
      await patchVendorBookingStatus(detail.id, "cancelled");
      bumpDetail();
    } catch (e: unknown) {
      setActionError(getApiErrorDetail(e) ?? "Could not cancel this booking.");
    } finally {
      setActionBusy(false);
      setPendingAction(null);
    }
  };

  const applyConfirmCompletion = async () => {
    if (!detail?.id || detail.status !== "accepted" || detail.payment_status !== "paid") return;
    setActionError(null);
    setActionBusy(true);
    setPendingAction("complete");
    try {
      await postVendorConfirmCompletion(detail.id);
      bumpDetail();
    } catch (e: unknown) {
      setActionError(getApiErrorDetail(e) ?? "Could not confirm completion.");
    } finally {
      setActionBusy(false);
      setPendingAction(null);
    }
  };

  const sendUpdatedPrice = async (rows: AdjDraftRow[]) => {
    if (!detail?.id || detail.status !== "pending") return;
    setActionError(null);
    const parsed: { tag: string; label: string; amount_gbp: number }[] = [];
    for (const r of rows) {
      const raw = Number.parseFloat(r.amount);
      if (!Number.isFinite(raw) || raw <= 0) {
        setActionError("Each line needs a valid positive amount.");
        return;
      }
      const amount_gbp = r.kind === "discount" ? -raw : raw;
      if (r.kind === "cost" && !r.label.trim()) {
        setActionError("Say what each extra charge is for.");
        return;
      }
      parsed.push({
        tag: (r.tag || "other").trim() || "other",
        label: r.label.trim() || (r.kind === "discount" ? "Discount" : "Additional cost"),
        amount_gbp,
      });
    }
    if (parsed.length === 0) {
      setActionError("Add a charge or discount first.");
      return;
    }
    setAdjSaving(true);
    try {
      const updated = await putVendorBookingAdjustments(detail.id, parsed);
      setDetail(updated);
    } catch (e: unknown) {
      setActionError(getApiErrorDetail(e) ?? "Could not send the updated price.");
    } finally {
      setAdjSaving(false);
    }
  };

  const rows = useMemo(() => {
    const mapped = list.map(toVendorBookingRowViewModel);
    if (payoutsReady || payoutsLoading) return mapped;
    return mapped.map((row) =>
      row.status === "pending"
        ? {
            ...row,
            warningBadge: "Payout setup required before accepting bookings.",
          }
        : row,
    );
  }, [list, payoutsReady, payoutsLoading]);

  const viewModel = detail
    ? toVendorBookingDetailViewModel(detail, () => setChatOpen(true))
    : null;

  const headerActions: BookingDetailAction[] = [];
  if (detail?.status === "pending" && detail.initiator === "vendor") {
    headerActions.push({
      key: "withdraw",
      label: "Withdraw quote",
      loadingLabel: "Withdrawing…",
      variant: "destructive",
      disabled: actionBusy,
      loading: pendingAction === "withdraw",
      onClick: () => setConfirmAction("withdraw"),
    });
  } else if (detail?.status === "declined" && detail.initiator !== "vendor") {
    headerActions.push({
      key: "accept",
      label: "Accept booking",
      loadingLabel: "Accepting…",
      variant: "primary",
      disabled: actionBusy || payoutsLoading,
      loading: pendingAction === "accept",
      onClick: () => requestAccept(),
    });
  }

  const footerActions: BookingDetailAction[] = [];
  if (
    detail?.status === "accepted" &&
    detail.payment_status !== "payout_released"
  ) {
    if (detail.payment_status === "paid" && !detail.vendor_completion_confirmed_at) {
      footerActions.push({
        key: "complete",
        label: "Confirm event complete",
        loadingLabel: "Confirming…",
        variant: "primary",
        disabled: actionBusy,
        loading: pendingAction === "complete",
        onClick: () => setConfirmAction("complete"),
      });
    }
    footerActions.push({
      key: "vendor_cancel",
      label: "Cancel booking",
      loadingLabel: "Cancelling…",
      variant: "secondary",
      disabled: actionBusy,
      loading: pendingAction === "vendor_cancel",
      onClick: () => setConfirmAction("vendor_cancel"),
    });
  }

  const vendorCancelCopy =
    detail?.payment_status === "paid"
      ? BOOKING_CONFIRM_COPY.cancelVendorPaid
      : BOOKING_CONFIRM_COPY.cancelVendor;

  const confirmCopy: Record<
    "withdraw" | "vendor_cancel" | "complete",
    {
      title: string;
      description: string;
      confirmLabel: string;
      loadingLabel: string;
      cancelLabel?: string;
      variant: "destructive" | "primary";
    }
  > = {
    withdraw: {
      title: BOOKING_CONFIRM_COPY.withdrawQuote.title,
      description: BOOKING_CONFIRM_COPY.withdrawQuote.description,
      cancelLabel: BOOKING_CONFIRM_COPY.withdrawQuote.cancelLabel,
      confirmLabel: BOOKING_CONFIRM_COPY.withdrawQuote.confirmLabel,
      loadingLabel: BOOKING_CONFIRM_COPY.withdrawQuote.confirmLoadingLabel,
      variant: "destructive",
    },
    vendor_cancel: {
      title: vendorCancelCopy.title,
      description: vendorCancelCopy.description,
      cancelLabel: vendorCancelCopy.cancelLabel,
      confirmLabel: vendorCancelCopy.confirmLabel,
      loadingLabel: vendorCancelCopy.confirmLoadingLabel,
      variant: "destructive",
    },
    complete: {
      title: BOOKING_CONFIRM_COPY.confirmComplete.title,
      description: BOOKING_CONFIRM_COPY.confirmComplete.description,
      confirmLabel: BOOKING_CONFIRM_COPY.confirmComplete.confirmLabel,
      loadingLabel: BOOKING_CONFIRM_COPY.confirmComplete.confirmLoadingLabel,
      variant: "primary",
    },
  };

  const showClientResponseFlow =
    detail?.status === "pending" && detail.initiator !== "vendor";

  const selectBooking = useCallback(
    (id: string) => router.push(`/vendor/bookings/${id}`),
    [router],
  );

  const handleConfirmAction = useCallback(() => {
    if (!confirmAction) return;
    const action = confirmAction;
    setConfirmAction(null);
    if (action === "withdraw") void applyWithdrawVendorQuote();
    else if (action === "vendor_cancel") void applyVendorCancel();
    else if (action === "complete") void applyConfirmCompletion();
  }, [confirmAction, applyWithdrawVendorQuote, applyVendorCancel, applyConfirmCompletion]);

  return {
    selectedBookingId,
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
    viewModel,
    headerActions,
    footerActions,
    actionBusy,
    adjSaving,
    confirmAction,
    setConfirmAction,
    confirmCopy,
    handleConfirmAction,
    payoutModalOpen,
    setPayoutModalOpen,
    connectingPayouts,
    payoutConnectError,
    setPayoutConnectError,
    onCompletePayoutSetup,
    showClientResponseFlow,
    requestAccept,
    applyBookingStatus,
    sendUpdatedPrice,
    selectBooking,
    applyWithdrawVendorQuote,
    applyVendorCancel,
    applyConfirmCompletion,
  };
}
