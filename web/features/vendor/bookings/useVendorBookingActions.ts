"use client";

import { useCallback, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { getApiErrorDetail, isPayoutSetupRequiredError } from "@/lib/api-errors";
import {
  patchVendorBookingStatus,
  postVendorConfirmCompletion,
  putVendorBookingAdjustments,
  type VendorBookingDetail,
} from "@/lib/vendorBookingsApi";
import {
  VENDOR_BOOKING_ERROR_COPY,
  VENDOR_BOOKING_TOAST_COPY,
} from "@/features/bookings/bookingConfirmCopy";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";
import { withMutationFeedback } from "@/lib/mutationFeedback";
import { clearPendingAcceptBookingId } from "@/features/vendor/payments/payoutAcceptIntent";
import type { AdjustmentDraftRow } from "@/features/vendor/bookings/vendorBookingResponseHelpers";

export type VendorBookingInFlightAction =
  | "accept"
  | "decline"
  | "complete"
  | "vendor_cancel"
  | "withdraw";

type UseVendorBookingActionsArgs = {
  detail: VendorBookingDetail | null;
  reloadBookingDetail: () => void;
  setDetail: (detail: VendorBookingDetail) => void;
  setActionError: (error: string | null) => void;
  onAcceptBlockedByPayoutSetup: () => void;
};

export function useVendorBookingActions({
  detail,
  reloadBookingDetail,
  setDetail,
  setActionError,
  onAcceptBlockedByPayoutSetup,
}: UseVendorBookingActionsArgs) {
  const { showToast } = useToast();
  const [actionBusy, setActionBusy] = useState(false);
  const [inFlightAction, setInFlightAction] = useState<VendorBookingInFlightAction | null>(null);
  const [adjustmentSaving, setAdjustmentSaving] = useState(false);

  const updateVendorBookingStatus = useCallback(
    async (next: "accepted" | "declined", bookingId?: string) => {
      const id = bookingId ?? detail?.booking_request_id;
      if (!id) return;
      if (detail && detail.booking_request_id === id && detail.initiator === "vendor") return;
      if (next === "declined" && detail && detail.booking_request_id === id && detail.booking_status !== "pending") {
        return;
      }
      if (
        next === "accepted" &&
        detail &&
        detail.booking_request_id === id &&
        detail.booking_status !== "pending" &&
        detail.booking_status !== "declined"
      ) {
        return;
      }
      setActionError(null);
      setActionBusy(true);
      setInFlightAction(next === "accepted" ? "accept" : "decline");
      let caught: unknown = null;
      const ok = await withMutationFeedback(showToast, {
        successTitle:
          next === "accepted"
            ? VENDOR_BOOKING_TOAST_COPY.bookingAccepted
            : VENDOR_BOOKING_TOAST_COPY.bookingDeclined,
        showErrorToast: false,
        run: async () => {
          try {
            await patchVendorBookingStatus(id, next);
            clearPendingAcceptBookingId();
            track(
              next === "accepted"
                ? MixpanelEvents.vendor_booking_accepted
                : MixpanelEvents.vendor_booking_declined,
              { booking_id: id },
            );
          } catch (e) {
            caught = e;
            throw e;
          }
        },
      });
      if (ok !== null) {
        reloadBookingDetail();
      } else if (caught) {
        const msg = getApiErrorDetail(caught) ?? (
          next === "accepted"
            ? VENDOR_BOOKING_ERROR_COPY.acceptFailed
            : VENDOR_BOOKING_ERROR_COPY.declineFailed
        );
        if (next === "accepted" && isPayoutSetupRequiredError(caught)) {
          onAcceptBlockedByPayoutSetup();
          setActionError(null);
        } else {
          setActionError(msg);
        }
      }
      setActionBusy(false);
      setInFlightAction(null);
    },
    [detail, onAcceptBlockedByPayoutSetup, reloadBookingDetail, setActionError, showToast],
  );

  const withdrawVendorQuote = async () => {
    if (!detail?.booking_request_id || detail.booking_status !== "pending" || detail.initiator !== "vendor") {
      return;
    }
    setActionError(null);
    setActionBusy(true);
    setInFlightAction("withdraw");
    let caught: unknown = null;
    const ok = await withMutationFeedback(showToast, {
      successTitle: VENDOR_BOOKING_TOAST_COPY.quoteWithdrawn,
      showErrorToast: false,
      run: async () => {
        try {
          await patchVendorBookingStatus(detail.booking_request_id, "cancelled");
          track(MixpanelEvents.vendor_quote_withdrawn, { booking_id: detail.booking_request_id });
        } catch (e) {
          caught = e;
          throw e;
        }
      },
    });
    if (ok !== null) reloadBookingDetail();
    else if (caught) {
      setActionError(getApiErrorDetail(caught) ?? VENDOR_BOOKING_ERROR_COPY.withdrawFailed);
    }
    setActionBusy(false);
    setInFlightAction(null);
  };

  const cancelVendorBooking = async () => {
    if (!detail?.booking_request_id || detail.booking_status !== "accepted") return;
    setActionError(null);
    setActionBusy(true);
    setInFlightAction("vendor_cancel");
    let caught: unknown = null;
    const ok = await withMutationFeedback(showToast, {
      successTitle: VENDOR_BOOKING_TOAST_COPY.bookingCancelled,
      showErrorToast: false,
      run: async () => {
        try {
          await patchVendorBookingStatus(detail.booking_request_id, "cancelled");
          track(MixpanelEvents.vendor_booking_cancelled, { booking_id: detail.booking_request_id });
        } catch (e) {
          caught = e;
          throw e;
        }
      },
    });
    if (ok !== null) reloadBookingDetail();
    else if (caught) {
      setActionError(getApiErrorDetail(caught) ?? VENDOR_BOOKING_ERROR_COPY.cancelFailed);
    }
    setActionBusy(false);
    setInFlightAction(null);
  };

  const confirmVendorCompletion = async () => {
    if (!detail?.booking_request_id || detail.booking_status !== "accepted" || detail.payment_status !== "paid") {
      return;
    }
    setActionError(null);
    setActionBusy(true);
    setInFlightAction("complete");
    let caught: unknown = null;
    const ok = await withMutationFeedback(showToast, {
      successTitle: VENDOR_BOOKING_TOAST_COPY.completionConfirmed,
      showErrorToast: false,
      run: async () => {
        try {
          await postVendorConfirmCompletion(detail.booking_request_id);
          track(MixpanelEvents.vendor_booking_completed, { booking_id: detail.booking_request_id });
        } catch (e) {
          caught = e;
          throw e;
        }
      },
    });
    if (ok !== null) reloadBookingDetail();
    else if (caught) {
      setActionError(getApiErrorDetail(caught) ?? VENDOR_BOOKING_ERROR_COPY.completionFailed);
    }
    setActionBusy(false);
    setInFlightAction(null);
  };

  const saveVendorPriceAdjustments = async (rows: AdjustmentDraftRow[]) => {
    if (!detail?.booking_request_id || detail.booking_status !== "pending") return;
    setActionError(null);
    const parsed: { adjustment_category: string; label: string; amount_gbp: number }[] = [];
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
        adjustment_category: (r.tag || "other").trim() || "other",
        label: r.label.trim() || (r.kind === "discount" ? "Discount" : "Additional cost"),
        amount_gbp,
      });
    }
    if (parsed.length === 0) {
      setActionError("Add a charge or discount first.");
      return;
    }
    setAdjustmentSaving(true);
    let caught: unknown = null;
    const updated = await withMutationFeedback(showToast, {
      successTitle: VENDOR_BOOKING_TOAST_COPY.updatedPriceSent,
      showErrorToast: false,
      run: async () => {
        try {
          const next = await putVendorBookingAdjustments(detail.booking_request_id, parsed);
          track(MixpanelEvents.vendor_booking_price_updated, {
            booking_id: detail.booking_request_id,
            line_count: parsed.length,
          });
          return next;
        } catch (e) {
          caught = e;
          throw e;
        }
      },
    });
    if (updated) setDetail(updated);
    else if (caught) {
      setActionError(getApiErrorDetail(caught) ?? VENDOR_BOOKING_ERROR_COPY.priceUpdateFailed);
    }
    setAdjustmentSaving(false);
  };

  return {
    actionBusy,
    inFlightAction,
    adjustmentSaving,
    updateVendorBookingStatus,
    withdrawVendorQuote,
    cancelVendorBooking,
    confirmVendorCompletion,
    saveVendorPriceAdjustments,
  };
}
