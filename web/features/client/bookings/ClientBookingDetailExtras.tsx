"use client";

import type { RefObject } from "react";
import { Button } from "@/components/ui/Button";
import { formatGbp } from "@/lib/vendorDiscountDisplay";
import { LottieIllustration } from "@/components/ui/LottieIllustration";
import { resolveWasClientTotalLabel } from "@/features/bookings/bookingPriceLabels";
import { BookingPriceUpdateBanner } from "@/features/bookings/BookingPriceUpdateBanner";
import { BookingCompletionBanner } from "@/features/bookings/BookingCompletionBanner";
import { ClientBookingTermsNotices } from "@/features/bookings/BookingTermsNotices";
import { BookingPayoutPendingBanner } from "@/features/bookings/BookingPayoutPendingBanner";
import { PAYMENT_FLOW_COPY, PAYMENT_SAFETY_COPY, isPayoutReleasePending, partialRefundBannerLine } from "@/features/bookings/bookingConfirmCopy";
import { ReceiptActions } from "@/features/receipts/ReceiptActions";
import { hasPaymentReceipt } from "@/lib/receiptsApi";
import type { ClientBookingDetail } from "@/lib/clientBookingsApi";
import { BookingDateChangeCard } from "@/features/bookings/BookingDateChangeCard";
import type { BookingDateChangeFields } from "@/lib/bookingDateChangeApi";

type ClientBookingDetailExtrasProps = {
  detail: ClientBookingDetail;
  showUpdatedPriceBanner: boolean;
  showCheckoutReturnBanner: boolean;
  checkoutReturnMessage: string;
  paymentBanner: string | null;
  paymentSyncError: string | null;
  paymentConfirmed: boolean;
  showCancelledRefunded: boolean;
  paymentDue: boolean;
  paymentBannerRef: RefObject<HTMLDivElement | null>;
  actionBusy: boolean;
  confirmingCompletion: boolean;
  pendingPriceAction: null | "accept" | "decline";
  onAcceptUpdatedPrice: () => void;
  onDeclineUpdatedPrice: () => void;
  onConfirmComplete: () => void;
  onPayNow: () => void;
  onDetailChanged: () => void;
};

export function ClientBookingDetailExtras({
  detail,
  showUpdatedPriceBanner,
  showCheckoutReturnBanner,
  checkoutReturnMessage,
  paymentBanner,
  paymentSyncError,
  paymentConfirmed,
  showCancelledRefunded,
  paymentDue,
  paymentBannerRef,
  actionBusy,
  confirmingCompletion,
  pendingPriceAction,
  onAcceptUpdatedPrice,
  onDeclineUpdatedPrice,
  onConfirmComplete,
  onPayNow,
  onDetailChanged,
}: ClientBookingDetailExtrasProps) {
  return (
    <>
      {detail.date_change_declined ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
          <p className="text-sm font-semibold text-amber-950">Your vendor declined the date change</p>
          <p className="mt-1 text-[13px] text-amber-950">
            The event stays on its original date. You can message them from this booking.
          </p>
        </div>
      ) : null}

      <BookingDateChangeCard
        role="client"
        bookingId={detail.booking_request_id}
        bookingStatus={detail.booking_status}
        paymentStatus={detail.payment_status}
        eventDate={detail.event_date}
        eventEndDate={detail.event_end_date}
        dateChange={detail as ClientBookingDetail & BookingDateChangeFields}
      />

      {showUpdatedPriceBanner ? (
        <BookingPriceUpdateBanner
          wasTotalLabel={resolveWasClientTotalLabel(detail)}
          nowTotalLabel={detail.pricing?.client_total_label ?? detail.total_label}
          pricing={detail.pricing}
          actionBusy={actionBusy}
          pendingAction={pendingPriceAction}
          onAccept={onAcceptUpdatedPrice}
          onDecline={onDeclineUpdatedPrice}
        />
      ) : null}

      {showCheckoutReturnBanner ? (
        <div
          className={`mt-4 rounded-2xl border px-5 py-4 text-sm ${
            paymentBanner === "cancelled"
              ? "border-amber-200 bg-amber-50 text-amber-950"
              : paymentSyncError
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-emerald-100 bg-emerald-50/60 text-neutral-800"
          }`}
        >
          {paymentBanner === "success" && !paymentSyncError ? (
            <LottieIllustration asset="successCheck" size="status" className="mb-2" />
          ) : paymentBanner === "cancelled" || paymentSyncError ? (
            <LottieIllustration
              asset={paymentSyncError ? "failure" : "pendingReview"}
              size="status"
              className="mb-2"
            />
          ) : null}
          {checkoutReturnMessage}
          {paymentBanner === "success" && paymentConfirmed && !paymentSyncError ? (
            <div className="mt-3">
              <ReceiptActions
                bookingId={detail.booking_request_id}
                documentType="client_payment_receipt"
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <BookingCompletionBanner
        viewer="client"
        status={detail.booking_status}
        paymentStatus={detail.payment_status}
        eventDate={detail.event_date}
        eventEndDate={detail.event_end_date}
        waitingOn={detail.completion_waiting_on}
        autoReleaseAt={detail.payout_auto_release_at}
        hasOpenDispute={detail.has_open_dispute}
        confirmDisabled={actionBusy || confirmingCompletion}
        onConfirm={onConfirmComplete}
      />

      <ClientBookingTermsNotices detail={detail} onChanged={onDetailChanged} />

      {isPayoutReleasePending(detail) ? (
        <BookingPayoutPendingBanner viewer="client" />
      ) : null}

      {showCancelledRefunded ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <LottieIllustration asset="pendingReview" size="status" className="mb-2" />
          {detail.cancellation_refund_percent != null &&
          detail.cancellation_refund_percent < 100 &&
          detail.cancellation_refund_gbp != null
            ? partialRefundBannerLine(
                `£${formatGbp(detail.cancellation_refund_gbp)}`,
                detail.cancellation_refund_percent,
              )
            : PAYMENT_FLOW_COPY.cancelledRefunded}
        </div>
      ) : null}

      {hasPaymentReceipt(detail.payment_status) &&
      !(paymentBanner === "success" && paymentConfirmed && !paymentSyncError) ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <ReceiptActions
            bookingId={detail.booking_request_id}
            documentType="client_payment_receipt"
          />
        </div>
      ) : null}

      {paymentDue ? (
        <div
          ref={paymentBannerRef}
          className="mt-4 overflow-hidden rounded-2xl border border-neutral-100 bg-white"
        >
          <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-neutral-900">
                {PAYMENT_FLOW_COPY.paymentDueTitle}
              </p>
              <p className="mt-1 text-[13px] text-neutral-600">
                {PAYMENT_FLOW_COPY.paymentDueSubtitle}
              </p>
              <p className="mt-1 text-[13px] text-neutral-400">{PAYMENT_FLOW_COPY.beforePay}</p>
              {detail.cancellation_policy_label ? (
                <details className="mt-2 text-[13px] text-neutral-600">
                  <summary className="cursor-pointer font-medium text-neutral-700">
                    {PAYMENT_SAFETY_COPY.cancellationPolicyHeading(detail.cancellation_policy_label)}
                  </summary>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {(detail.cancellation_policy_lines ?? []).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>
            <Button variant="primary" size="md" className="shrink-0" onClick={onPayNow}>
              {PAYMENT_FLOW_COPY.payNowLabel}
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
