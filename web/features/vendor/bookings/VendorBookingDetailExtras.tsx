"use client";

import { LottieIllustration } from "@/components/ui/LottieIllustration";
import { BookingCompletionBanner } from "@/features/bookings/BookingCompletionBanner";
import { VendorBookingTermsNotices } from "@/features/bookings/BookingTermsNotices";
import { BookingPayoutPendingBanner } from "@/features/bookings/BookingPayoutPendingBanner";
import {
  isPayoutReleasePending,
  PAYMENT_FLOW_COPY,
  vendorCancellationShareLine,
} from "@/features/bookings/bookingConfirmCopy";
import { formatGbp } from "@/lib/vendorDiscountDisplay";
import { ReceiptActions } from "@/features/receipts/ReceiptActions";
import { hasPaymentReceipt } from "@/lib/receiptsApi";
import type { VendorBookingDetail } from "@/lib/vendorBookingsApi";
import { BookingDateChangeCard } from "@/features/bookings/BookingDateChangeCard";
import type { BookingDateChangeFields } from "@/lib/bookingDateChangeApi";

type VendorBookingDetailExtrasProps = {
  detail: VendorBookingDetail;
  actionBusy: boolean;
  onConfirmComplete: () => void;
  onRetryPayout: () => void;
  onDetailChanged: () => void;
};

export function VendorBookingDetailExtras({
  detail,
  actionBusy,
  onConfirmComplete,
  onRetryPayout,
  onDetailChanged,
}: VendorBookingDetailExtrasProps) {
  return (
    <>
      <BookingDateChangeCard
        role="vendor"
        bookingId={detail.booking_request_id}
        bookingStatus={detail.booking_status}
        paymentStatus={detail.payment_status}
        eventDate={detail.event_date}
        eventEndDate={detail.event_end_date}
        dateChange={detail as VendorBookingDetail & BookingDateChangeFields}
      />

      {detail.booking_status === "accepted" && detail.payment_status === "unpaid" ? (
        <div className="rounded-2xl border border-neutral-100 bg-neutral-50 px-5 py-4">
          <p className="text-sm font-semibold text-neutral-900">Waiting on the client&apos;s payment</p>
          <p className="mt-1 text-[13px] text-neutral-600">
            You&apos;ll be able to confirm the event is complete once their payment goes through.
          </p>
        </div>
      ) : null}

      <BookingCompletionBanner
        viewer="vendor"
        status={detail.booking_status}
        paymentStatus={detail.payment_status}
        eventDate={detail.event_date}
        eventEndDate={detail.event_end_date}
        waitingOn={detail.completion_waiting_on}
        autoReleaseAt={detail.payout_auto_release_at}
        hasOpenDispute={detail.has_open_dispute}
        confirmDisabled={actionBusy}
        onConfirm={onConfirmComplete}
      />

      <VendorBookingTermsNotices detail={detail} onChanged={onDetailChanged} />

      {isPayoutReleasePending(detail) ? (
        <BookingPayoutPendingBanner
          viewer="vendor"
          onRetryRelease={onRetryPayout}
          retryDisabled={actionBusy}
          retryLoading={actionBusy}
        />
      ) : null}

      {detail.booking_status === "cancelled" &&
      (detail.payment_status === "refunded" || detail.payment_status === "partially_refunded") ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <LottieIllustration asset="pendingReview" size="status" className="mb-2" ariaLabel="" />
          {detail.cancellation_refund_percent != null && detail.cancellation_refund_percent < 100
            ? PAYMENT_FLOW_COPY.cancelledPartialRefundVendor
            : PAYMENT_FLOW_COPY.cancelledRefundedVendor}
        </div>
      ) : null}

      {detail.booking_status === "cancelled" && (detail.cancellation_vendor_share_gbp ?? 0) > 0 ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-950">
          {vendorCancellationShareLine(
            `£${formatGbp(detail.cancellation_vendor_share_gbp ?? 0)}`,
            detail.cancellation_payout_at,
          )}
        </div>
      ) : null}

      {hasPaymentReceipt(detail.payment_status) ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <ReceiptActions
            bookingId={detail.booking_request_id}
            documentType="vendor_payment_record"
          />
          {detail.payment_status === "payout_released" ? (
            <ReceiptActions
              bookingId={detail.booking_request_id}
              documentType="vendor_payout_statement"
            />
          ) : null}
        </div>
      ) : null}
    </>
  );
}
