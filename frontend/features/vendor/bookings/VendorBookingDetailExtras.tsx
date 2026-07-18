"use client";

import { BookingCompletionBanner } from "@/features/bookings/BookingCompletionBanner";
import { PAYMENT_FLOW_COPY } from "@/features/bookings/bookingConfirmCopy";
import type { VendorBookingDetail } from "@/lib/vendorBookingsApi";

type VendorBookingDetailExtrasProps = {
  detail: VendorBookingDetail;
  actionBusy: boolean;
  onConfirmComplete: () => void;
};

export function VendorBookingDetailExtras({
  detail,
  actionBusy,
  onConfirmComplete,
}: VendorBookingDetailExtrasProps) {
  return (
    <>
      {detail.status === "accepted" && detail.payment_status === "unpaid" ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-4 shadow-sm">
          <p className="text-sm font-semibold text-amber-950">Waiting on the client&apos;s payment</p>
          <p className="mt-1 text-sm text-amber-900/90">
            The client hasn&apos;t paid yet. You&apos;ll be able to confirm the event is complete once
            their payment goes through.
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

      {detail.status === "cancelled" &&
      (detail.payment_status === "refunded" || detail.payment_status === "partially_refunded") ? (
        <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 pb-4 pt-5 text-sm text-neutral-700">
          {PAYMENT_FLOW_COPY.cancelledRefundedVendor}
        </div>
      ) : null}
    </>
  );
}
