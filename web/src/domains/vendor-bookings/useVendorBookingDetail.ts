"use client";

import { useCallback, useEffect, useState } from "react";
import { GENERIC_ERROR_MESSAGE, hasCode, platformErrorDetail } from "@/foundation/platform-client";
import {
  fetchVendorBookingDetail,
  patchVendorBookingStatus,
  postVendorConfirmCompletion,
  putVendorBookingAdjustments,
  type VendorAdjustmentIn,
  type VendorBookingDetail,
} from "@/domains/vendor-bookings/api";

/** Which mutation is currently in flight, so the right button shows a busy state. */
export type VendorBookingAction = "accept" | "decline" | "withdraw" | "cancel" | "complete" | "adjustments";

/** One completed (or failed) fetch, tagged with the booking id it answered. */
interface LoadResult {
  bookingId: string;
  booking: VendorBookingDetail | null;
  error: string | null;
}

/**
 * Loads one booking and exposes every mutation its detail page can perform:
 * accept/decline (a client's enquiry), withdraw (the vendor's own pending
 * quote), cancel (an accepted booking), confirm completion, and replace the
 * extras/discounts. Each mutation re-syncs from the server response rather
 * than guessing the new state locally.
 *
 * `loading` is derived from whether the latest result answers the current
 * `bookingId`, and every `setState` happens inside the fetch's
 * `.then`/`.catch` rather than synchronously in the effect body — the same
 * shape as `useVendorBookingsList` and `useVerifyEmail`, which keeps the
 * initial load out of the "setState synchronously in an effect" lint rule.
 */
export function useVendorBookingDetail(bookingId: string) {
  const [result, setResult] = useState<LoadResult | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<VendorBookingAction | null>(null);

  const load = useCallback(() => {
    fetchVendorBookingDetail(bookingId)
      .then((booking) => setResult({ bookingId, booking, error: null }))
      .catch((cause: unknown) => setResult({ bookingId, booking: null, error: platformErrorDetail(cause) ?? GENERIC_ERROR_MESSAGE }));
  }, [bookingId]);

  useEffect(() => {
    load();
  }, [load]);

  async function runAction(action: VendorBookingAction, task: () => Promise<void>) {
    setActionError(null);
    setPendingAction(action);
    try {
      await task();
    } catch (cause: unknown) {
      // A blocked accept (Stripe Connect payout details missing) is its own
      // known code; every other failure just shows the server's detail.
      if (hasCode(cause, "payout_setup_required")) {
        setActionError("Finish your payout setup in Payments before accepting a booking.");
      } else {
        setActionError(platformErrorDetail(cause) ?? GENERIC_ERROR_MESSAGE);
      }
    } finally {
      setPendingAction(null);
    }
  }

  const accept = () => runAction("accept", async () => {
    await patchVendorBookingStatus(bookingId, "accepted");
    load();
  });

  const decline = () => runAction("decline", async () => {
    await patchVendorBookingStatus(bookingId, "declined");
    load();
  });

  const withdraw = () => runAction("withdraw", async () => {
    await patchVendorBookingStatus(bookingId, "cancelled");
    load();
  });

  const cancel = () => runAction("cancel", async () => {
    await patchVendorBookingStatus(bookingId, "cancelled");
    load();
  });

  const confirmCompletion = () => runAction("complete", async () => {
    await postVendorConfirmCompletion(bookingId);
    load();
  });

  const saveAdjustments = (adjustments: VendorAdjustmentIn[]) =>
    runAction("adjustments", async () => {
      const updated = await putVendorBookingAdjustments(bookingId, adjustments);
      setResult({ bookingId, booking: updated, error: null });
    });

  const loading = result === null || result.bookingId !== bookingId;

  return {
    booking: loading ? null : result.booking,
    loading,
    loadError: loading ? null : result.error,
    actionError,
    pendingAction,
    reload: load,
    accept,
    decline,
    withdraw,
    cancel,
    confirmCompletion,
    saveAdjustments,
  };
}
