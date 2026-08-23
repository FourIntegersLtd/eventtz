"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getPendingAcceptBookingId,
} from "@/features/vendor/payments/payoutAcceptIntent";
import {
  isVendorPayoutsReady,
  type useVendorPayoutsReady,
} from "@/features/vendor/payments/useVendorPayoutsReady";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";

type PayoutsReadyApi = ReturnType<typeof useVendorPayoutsReady>;

type UseVendorPayoutAcceptResumeArgs = {
  selectedBookingId?: string;
  payouts: Pick<PayoutsReadyApi, "refresh" | "setError">;
  updateVendorBookingStatus: (next: "accepted" | "declined", bookingId?: string) => Promise<void>;
  openPayoutSetupModal: () => void;
};

/** After Stripe Connect return/refresh, resume the pending accept when payouts are ready. */
export function useVendorPayoutAcceptResume({
  selectedBookingId,
  payouts,
  updateVendorBookingStatus,
  openPayoutSetupModal,
}: UseVendorPayoutAcceptResumeArgs) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resumeAcceptHandled = useRef(false);

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
      const status = await payouts.refresh();
      const pendingId = getPendingAcceptBookingId();
      const ready = isVendorPayoutsReady(status);
      if (stripeParam === "return" && ready) {
        track(MixpanelEvents.vendor_payouts_ready, { source: "bookings" });
      }
      if (stripeParam === "return" && pendingId === selectedBookingId && ready) {
        await updateVendorBookingStatus("accepted", selectedBookingId);
        return;
      }
      if (pendingId === selectedBookingId && !ready) {
        openPayoutSetupModal();
        payouts.setError(
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
    payouts,
    updateVendorBookingStatus,
    openPayoutSetupModal,
  ]);
}
