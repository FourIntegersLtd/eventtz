"use client";

import { useCallback, useEffect, useState } from "react";
import { GENERIC_ERROR_MESSAGE, platformErrorDetail } from "@/foundation/platform-client";
import {
  fetchClientBookingDetail,
  patchClientBookingStatus,
  postCancelClientBooking,
  postClientBookingReview,
  postClientConfirmCompletion,
  type ClientBookingDetail,
  type PostBookingReviewBody,
} from "@/domains/client-bookings/api";
import { CLIENT_BOOKING_ERROR_COPY } from "@/domains/client-bookings/bookingCopy";

/** Which mutation is currently in flight, so the right control shows a busy state. */
export type ClientBookingAction =
  | "cancel"
  | "acceptQuote"
  | "declineQuote"
  | "acceptPriceUpdate"
  | "declinePriceUpdate"
  | "confirmCompletion"
  | "submitReview";

/** One completed (or failed) fetch, tagged with the booking id it answered. */
interface LoadResult {
  bookingId: string;
  booking: ClientBookingDetail | null;
  error: string | null;
}

/**
 * Loads one booking and exposes every mutation the detail page can perform:
 * accept/decline a vendor's quote or updated price, cancel, confirm
 * completion, and submit a review. The venue is set on the pay page. Each
 * mutation re-syncs from the server rather than guessing the new state.
 *
 * `loading` is derived from whether the latest result answers the current
 * `bookingId`, and every `setState` happens inside the fetch's `.then`/`.catch`
 * rather than synchronously in the effect body — the same shape as
 * `useVendorBookingDetail`.
 */
export function useClientBookingDetail(bookingId: string) {
  const [result, setResult] = useState<LoadResult | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<ClientBookingAction | null>(null);

  const load = useCallback(() => {
    fetchClientBookingDetail(bookingId)
      .then((booking) => setResult({ bookingId, booking, error: null }))
      .catch((cause: unknown) => setResult({ bookingId, booking: null, error: platformErrorDetail(cause) ?? GENERIC_ERROR_MESSAGE }));
  }, [bookingId]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Runs one mutation, showing the server's message (or the baseline's
   * fallback for that action) on failure. Resolves true on success so the
   * caller can close its confirmation dialog.
   */
  async function runAction(
    action: ClientBookingAction,
    fallbackError: string,
    task: () => Promise<void>,
  ): Promise<boolean> {
    setActionError(null);
    setPendingAction(action);
    try {
      await task();
      return true;
    } catch (cause: unknown) {
      setActionError(platformErrorDetail(cause) ?? fallbackError);
      return false;
    } finally {
      setPendingAction(null);
    }
  }

  const cancel = () =>
    runAction("cancel", CLIENT_BOOKING_ERROR_COPY.cancelFailed, async () => {
      await postCancelClientBooking(bookingId);
      load();
    });

  const respondToQuote = (status: "accepted" | "declined") =>
    runAction(status === "accepted" ? "acceptQuote" : "declineQuote", CLIENT_BOOKING_ERROR_COPY.quoteFailed, async () => {
      await patchClientBookingStatus(bookingId, status);
      load();
    });

  const respondToPriceUpdate = (status: "accepted" | "declined") =>
    runAction(
      status === "accepted" ? "acceptPriceUpdate" : "declinePriceUpdate",
      CLIENT_BOOKING_ERROR_COPY.priceUpdateFailed,
      async () => {
        await patchClientBookingStatus(bookingId, status);
        load();
      },
    );

  const confirmCompletion = () =>
    runAction("confirmCompletion", CLIENT_BOOKING_ERROR_COPY.completionFailed, async () => {
      await postClientConfirmCompletion(bookingId);
      load();
    });

  const submitReview = (body: PostBookingReviewBody) =>
    runAction("submitReview", CLIENT_BOOKING_ERROR_COPY.reviewFailed, async () => {
      await postClientBookingReview(bookingId, body);
      load();
    });

  const loading = result === null || result.bookingId !== bookingId;

  return {
    booking: loading ? null : result.booking,
    loading,
    loadError: loading ? null : result.error,
    actionError,
    pendingAction,
    reload: load,
    cancel,
    respondToQuote,
    respondToPriceUpdate,
    confirmCompletion,
    submitReview,
  };
}
