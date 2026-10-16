"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { getApiErrorDetail } from "@/lib/api-errors";
import {
  patchClientBookingStatus,
  postCancelClientBooking,
  postClientConfirmCompletion,
  type ClientBookingDetail,
} from "@/lib/clientBookingsApi";
import {
  CLIENT_BOOKING_ERROR_COPY,
  CLIENT_BOOKING_TOAST_COPY,
} from "@/features/bookings/bookingConfirmCopy";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";
import { withMutationFeedback } from "@/lib/mutationFeedback";

type UseClientBookingActionsArgs = {
  detail: ClientBookingDetail | null;
  bumpDetail: () => void;
  setActionError: (error: string | null) => void;
};

export function useClientBookingActions({
  detail,
  bumpDetail,
  setActionError,
}: UseClientBookingActionsArgs) {
  const { showToast } = useToast();
  const [actionBusy, setActionBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [declineQuoteOpen, setDeclineQuoteOpen] = useState(false);
  const [declinePriceOpen, setDeclinePriceOpen] = useState(false);
  const [pendingQuoteAction, setPendingQuoteAction] = useState<null | "accept" | "decline">(null);
  const [pendingPriceAction, setPendingPriceAction] = useState<null | "accept" | "decline">(null);
  const [confirmingCompletion, setConfirmingCompletion] = useState(false);
  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false);

  const confirmCancelBooking = async () => {
    if (!detail?.booking_request_id) return;
    const bookingId = detail.booking_request_id;
    setActionError(null);
    setActionBusy(true);
    let caught: unknown = null;
    const ok = await withMutationFeedback(showToast, {
      successTitle: CLIENT_BOOKING_TOAST_COPY.bookingCancelled,
      showErrorToast: false,
      run: async () => {
        try {
          await postCancelClientBooking(bookingId);
          track(MixpanelEvents.booking_cancelled, { booking_id: bookingId });
        } catch (e) {
          caught = e;
          throw e;
        }
      },
    });
    if (ok !== null) {
      setCancelOpen(false);
      bumpDetail();
    } else if (caught) {
      setActionError(getApiErrorDetail(caught) ?? CLIENT_BOOKING_ERROR_COPY.cancelFailed);
    }
    setActionBusy(false);
  };

  const applyClientQuoteResponse = async (next: "accepted" | "declined") => {
    if (!detail?.booking_request_id) return;
    if (detail.initiator !== "vendor" || detail.booking_status !== "pending") return;
    const bookingId = detail.booking_request_id;
    setActionError(null);
    setActionBusy(true);
    setPendingQuoteAction(next === "accepted" ? "accept" : "decline");
    let caught: unknown = null;
    const ok = await withMutationFeedback(showToast, {
      successTitle:
        next === "accepted"
          ? CLIENT_BOOKING_TOAST_COPY.quoteAccepted
          : CLIENT_BOOKING_TOAST_COPY.quoteDeclined,
      showErrorToast: false,
      run: async () => {
        try {
          await patchClientBookingStatus(bookingId, next);
          track(
            next === "accepted"
              ? MixpanelEvents.booking_quote_accepted
              : MixpanelEvents.booking_quote_declined,
            { booking_id: bookingId },
          );
        } catch (e) {
          caught = e;
          throw e;
        }
      },
    });
    if (ok !== null) {
      bumpDetail();
    } else if (caught) {
      setActionError(getApiErrorDetail(caught) ?? CLIENT_BOOKING_ERROR_COPY.quoteFailed);
    }
    setActionBusy(false);
    setPendingQuoteAction(null);
  };

  const applyClientUpdatedPriceResponse = async (next: "accepted" | "declined") => {
    if (!detail?.booking_request_id) return;
    if (detail.initiator !== "client" || detail.booking_status !== "pending") return;
    if (detail.vendor_adjustments.length === 0) return;
    const bookingId = detail.booking_request_id;
    setActionError(null);
    setActionBusy(true);
    setPendingPriceAction(next === "accepted" ? "accept" : "decline");
    let caught: unknown = null;
    const ok = await withMutationFeedback(showToast, {
      successTitle:
        next === "accepted"
          ? CLIENT_BOOKING_TOAST_COPY.priceUpdateAccepted
          : CLIENT_BOOKING_TOAST_COPY.priceUpdateDeclined,
      showErrorToast: false,
      run: async () => {
        try {
          await patchClientBookingStatus(bookingId, next);
          track(
            next === "accepted"
              ? MixpanelEvents.booking_price_update_accepted
              : MixpanelEvents.booking_price_update_declined,
            { booking_id: bookingId },
          );
        } catch (e) {
          caught = e;
          throw e;
        }
      },
    });
    if (ok !== null) {
      bumpDetail();
    } else if (caught) {
      setActionError(getApiErrorDetail(caught) ?? CLIENT_BOOKING_ERROR_COPY.priceUpdateFailed);
    }
    setActionBusy(false);
    setPendingPriceAction(null);
  };

  const confirmCompletion = async () => {
    if (!detail?.booking_request_id) return;
    const bookingId = detail.booking_request_id;
    setActionError(null);
    setConfirmingCompletion(true);
    let caught: unknown = null;
    const ok = await withMutationFeedback(showToast, {
      successTitle: CLIENT_BOOKING_TOAST_COPY.completionConfirmed,
      showErrorToast: false,
      run: async () => {
        try {
          await postClientConfirmCompletion(bookingId);
          track(MixpanelEvents.booking_completed, { booking_id: bookingId });
        } catch (e) {
          caught = e;
          throw e;
        }
      },
    });
    if (ok !== null) {
      setConfirmCompleteOpen(false);
      bumpDetail();
    } else if (caught) {
      setActionError(getApiErrorDetail(caught) ?? CLIENT_BOOKING_ERROR_COPY.completionFailed);
    }
    setConfirmingCompletion(false);
  };

  return {
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
  };
}
