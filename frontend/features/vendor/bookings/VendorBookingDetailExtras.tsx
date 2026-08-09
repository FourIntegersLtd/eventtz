"use client";

import { LottieIllustration } from "@/components/ui/LottieIllustration";
import { BookingCompletionBanner } from "@/features/bookings/BookingCompletionBanner";
import { BookingPayoutPendingBanner } from "@/features/bookings/BookingPayoutPendingBanner";
import { isPayoutReleasePending, PAYMENT_FLOW_COPY } from "@/features/bookings/bookingConfirmCopy";
import type { VendorBookingDetail } from "@/lib/vendorBookingsApi";

type VendorBookingDetailExtrasProps = {
  detail: VendorBookingDetail;
  actionBusy: boolean;
  onConfirmComplete: () => void;
  onRetryPayout: () => void;
};

export function VendorBookingDetailExtras({
  detail,
  actionBusy,
  onConfirmComplete,
  onRetryPayout,
}: VendorBookingDetailExtrasProps) {
  return (
    <>
      {detail.status === "accepted" && detail.payment_status === "unpaid" ? (
        <div className="rounded-2xl border border-neutral-100 bg-neutral-50 px-5 py-4">
          <p className="text-sm font-semibold text-neutral-900">Waiting on the client&apos;s payment</p>
          <p className="mt-1 text-[13px] text-neutral-600">
            You&apos;ll be able to confirm the event is complete once their payment goes through.
          </p>
        </div>
      ) : null}

      <BookingCompletionBanner
        viewer="vendor"
        status={detail.status}
        paymentStatus={detail.payment_status}
        eventDate={detail.event_date}
        eventEndDate={detail.event_end_date}
        waitingOn={detail.completion_waiting_on}
        autoReleaseAt={detail.payout_auto_release_at}
        confirmDisabled={actionBusy}
        onConfirm={onConfirmComplete}
      />

      {isPayoutReleasePending(detail) ? (
        <BookingPayoutPendingBanner
          viewer="vendor"
          onRetryRelease={onRetryPayout}
          retryDisabled={actionBusy}
          retryLoading={actionBusy}
        />
      ) : null}

      {detail.status === "cancelled" &&
      (detail.payment_status === "refunded" || detail.payment_status === "partially_refunded") ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <LottieIllustration asset="pendingReview" size="status" className="mb-2" ariaLabel="" />
          {PAYMENT_FLOW_COPY.cancelledRefundedVendor}
        </div>
      ) : null}
    </>
  );
}
