"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { BookingDetailAction } from "@/features/bookings/bookingViewModel";
import { useParticipantBookingsScaffold } from "@/features/bookings/useParticipantBookingsScaffold";
import { BOOKING_CONFIRM_COPY } from "@/features/bookings/bookingConfirmCopy";
import { setPendingAcceptBookingId } from "@/features/vendor/payments/payoutAcceptIntent";
import { useVendorPayoutsReady } from "@/features/vendor/payments/useVendorPayoutsReady";
import {
  fetchVendorBookingDetail,
  fetchVendorBookingsPage,
  VENDOR_BOOKINGS_PAGE_SIZE,
  type VendorBookingDetail,
} from "@/lib/vendorBookingsApi";
import {
  toVendorBookingDetailViewModel,
  toVendorBookingRowViewModel,
} from "@/features/vendor/bookings/vendorBookingViewModel";
import { useVendorBookingActions } from "@/features/vendor/bookings/useVendorBookingActions";
import { useVendorPayoutAcceptResume } from "@/features/vendor/bookings/useVendorPayoutAcceptResume";
import { bookingEventGroupsForList } from "@/features/bookings/groupBookingsByEvent";
import { useDesignDiffPayoutPreview } from "@/features/vendor/design/useDesignDiffStatic";

type UseVendorBookingsControllerArgs = {
  selectedBookingId?: string;
};

export function useVendorBookingsController({ selectedBookingId }: UseVendorBookingsControllerArgs) {
  const searchParams = useSearchParams();
  const listStatusFilter = searchParams.get("status") ?? "";
  const urlTab = searchParams.get("tab");
  const [listSearch, setListSearch] = useState("");

  const fetchListPage = useCallback(
    async (t: "active" | "closed", offset: number, limit: number) => {
      const page = await fetchVendorBookingsPage({
        group: t,
        offset,
        limit,
        ...(listStatusFilter === "pending" ? { status: "pending" } : {}),
        ...(listSearch.trim() ? { q: listSearch.trim() } : {}),
      });
      return {
        items: page.bookings,
        total: page.total,
        offset: page.offset,
        limit: page.limit,
      };
    },
    [listStatusFilter, listSearch],
  );
  const fetchDetail = useCallback((id: string) => fetchVendorBookingDetail(id), []);
  const getDetailStatus = useCallback((b: VendorBookingDetail) => b.booking_status, []);

  const {
    tab,
    setTab,
    list,
    listTotal,
    listOffset,
    listPageSize,
    setListOffset,
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
    fetchListPage,
    pageSize: VENDOR_BOOKINGS_PAGE_SIZE,
    fetchDetail,
    getDetailStatus,
  });
  const reloadBookingDetail = bumpDetail;

  const [chatPrefill, setChatPrefill] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<null | "withdraw" | "vendor_cancel" | "complete">(
    null,
  );
  const payoutPreview = useDesignDiffPayoutPreview();
  const [payoutModalOpen, setPayoutModalOpen] = useState(false);

  useEffect(() => {
    if (urlTab === "active" || urlTab === "closed") {
      setTab(urlTab);
    }
  }, [urlTab, setTab]);

  useEffect(() => {
    setListOffset(0);
  }, [listSearch, setListOffset]);

  useEffect(() => {
    if (payoutPreview) {
      setPayoutModalOpen(true);
    }
  }, [payoutPreview]);

  const {
    payoutsReady,
    loading: payoutsLoading,
    connecting: connectingPayouts,
    error: payoutConnectError,
    setError: setPayoutConnectError,
    refresh: refreshPayouts,
    connectPayouts,
  } = useVendorPayoutsReady(true);

  const {
    actionBusy,
    inFlightAction,
    adjustmentSaving,
    updateVendorBookingStatus,
    withdrawVendorQuote,
    cancelVendorBooking,
    confirmVendorCompletion,
    saveVendorPriceAdjustments,
  } = useVendorBookingActions({
    detail,
    reloadBookingDetail,
    setDetail: (next) => setDetail(next),
    setActionError,
    onAcceptBlockedByPayoutSetup: () => setPayoutModalOpen(true),
  });

  const requestAccept = useCallback(() => {
    if (!detail?.booking_request_id) return;
    if (payoutsLoading) return;
    if (!payoutsReady) {
      setPayoutModalOpen(true);
      return;
    }
    void updateVendorBookingStatus("accepted");
  }, [detail?.booking_request_id, payoutsLoading, payoutsReady, updateVendorBookingStatus]);

  const onCompletePayoutSetup = useCallback(() => {
    if (!detail?.booking_request_id) return;
    setPendingAcceptBookingId(detail.booking_request_id);
    void connectPayouts(`/vendor/bookings/${detail.booking_request_id}`);
  }, [detail?.booking_request_id, connectPayouts]);

  useVendorPayoutAcceptResume({
    selectedBookingId,
    payouts: { refresh: refreshPayouts, setError: setPayoutConnectError },
    updateVendorBookingStatus,
    openPayoutSetupModal: () => setPayoutModalOpen(true),
  });

  const rows = useMemo(() => {
    const mapped = list.map(toVendorBookingRowViewModel);
    if (payoutsReady || payoutsLoading) return mapped;
    return mapped.map((row) =>
      row.status === "pending"
        ? { ...row, warningBadge: "Payout setup required before accepting bookings." }
        : row,
    );
  }, [list, payoutsReady, payoutsLoading]);

  const listItemsById = useMemo(
    () => new Map(list.map((item) => [item.booking_request_id, item])),
    [list],
  );
  const eventGroups = useMemo(
    () => bookingEventGroupsForList(rows, listItemsById, "client", tab === "active"),
    [tab, rows, listItemsById],
  );

  const viewModel = detail
    ? toVendorBookingDetailViewModel(detail, () => setChatOpen(true))
    : null;

  const headerActions: BookingDetailAction[] = [];
  if (detail?.booking_status === "pending" && detail.initiator === "vendor") {
    headerActions.push({
      key: "withdraw",
      label: "Withdraw quote",
      loadingLabel: "Withdrawing…",
      variant: "destructive",
      disabled: actionBusy,
      loading: inFlightAction === "withdraw",
      onClick: () => setConfirmAction("withdraw"),
    });
  } else if (detail?.booking_status === "declined" && detail.initiator !== "vendor") {
    headerActions.push({
      key: "accept",
      label: "Accept booking",
      loadingLabel: "Accepting…",
      variant: "primary",
      disabled: actionBusy || payoutsLoading,
      loading: inFlightAction === "accept",
      onClick: () => requestAccept(),
    });
  }

  const footerActions: BookingDetailAction[] = [];
  const paymentStatus = detail?.payment_status ?? "";
  const cancelBlocked =
    paymentStatus === "payout_released" || paymentStatus === "partially_refunded";
  if (detail?.booking_status === "accepted" && !cancelBlocked) {
    footerActions.push({
      key: "vendor_cancel",
      label: "Cancel booking",
      loadingLabel: "Cancelling…",
      variant: "secondary",
      disabled: actionBusy,
      loading: inFlightAction === "vendor_cancel",
      onClick: () => setConfirmAction("vendor_cancel"),
    });
  }

  const vendorCancelCopy =
    paymentStatus === "paid"
      ? BOOKING_CONFIRM_COPY.cancelVendorPaid
      : paymentStatus === "pending"
        ? BOOKING_CONFIRM_COPY.cancelVendorPending
        : BOOKING_CONFIRM_COPY.cancelVendor;

  const confirmCopy = {
    withdraw: {
      title: BOOKING_CONFIRM_COPY.withdrawQuote.title,
      description: BOOKING_CONFIRM_COPY.withdrawQuote.description,
      cancelLabel: BOOKING_CONFIRM_COPY.withdrawQuote.cancelLabel,
      confirmLabel: BOOKING_CONFIRM_COPY.withdrawQuote.confirmLabel,
      loadingLabel: BOOKING_CONFIRM_COPY.withdrawQuote.confirmLoadingLabel,
      variant: "destructive" as const,
    },
    vendor_cancel: {
      title: vendorCancelCopy.title,
      description: vendorCancelCopy.description,
      cancelLabel: vendorCancelCopy.cancelLabel,
      confirmLabel: vendorCancelCopy.confirmLabel,
      loadingLabel: vendorCancelCopy.confirmLoadingLabel,
      variant: "destructive" as const,
    },
    complete: {
      title: BOOKING_CONFIRM_COPY.confirmComplete.title,
      description: BOOKING_CONFIRM_COPY.confirmComplete.description,
      cancelLabel: "Go back",
      confirmLabel: BOOKING_CONFIRM_COPY.confirmComplete.confirmLabel,
      loadingLabel: BOOKING_CONFIRM_COPY.confirmComplete.confirmLoadingLabel,
      variant: "primary" as const,
    },
  };

  const showClientResponseFlow =
    detail?.booking_status === "pending" && detail.initiator !== "vendor";

  const handleConfirmAction = useCallback(() => {
    if (!confirmAction) return;
    const action = confirmAction;
    setConfirmAction(null);
    if (action === "withdraw") void withdrawVendorQuote();
    else if (action === "vendor_cancel") void cancelVendorBooking();
    else if (action === "complete") void confirmVendorCompletion();
  }, [confirmAction, withdrawVendorQuote, cancelVendorBooking, confirmVendorCompletion]);

  return {
    selectedBookingId,
    tab,
    setTab,
    list,
    listTotal,
    listOffset,
    listPageSize,
    setListOffset,
    listSearch,
    setListSearch,
    listLoading,
    listError,
    detail,
    reloadBookingDetail,
    setDetail,
    detailLoading,
    detailError,
    actionError,
    chatOpen,
    setChatOpen,
    chatPrefill,
    setChatPrefill,
    rows,
    eventGroups,
    viewModel,
    headerActions,
    footerActions,
    actionBusy,
    adjustmentSaving,
    confirmAction,
    setConfirmAction,
    confirmCopy,
    handleConfirmAction,
    payoutModalOpen,
    setPayoutModalOpen,
    payoutsLoading,
    payoutsReady,
    connectingPayouts,
    payoutConnectError,
    setPayoutConnectError,
    onCompletePayoutSetup,
    showClientResponseFlow,
    requestAccept,
    applyBookingStatus: updateVendorBookingStatus,
    sendUpdatedPrice: saveVendorPriceAdjustments,
    applyConfirmCompletion: confirmVendorCompletion,
  };
}
