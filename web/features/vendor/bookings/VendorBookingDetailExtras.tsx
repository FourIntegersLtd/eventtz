"use client";

import Link from "next/link";
import { BookingCompletionBanner } from "@/features/bookings/BookingCompletionBanner";
import { VendorBookingTermsNotices } from "@/features/bookings/BookingTermsNotices";
import { BookingPayoutPendingBanner } from "@/features/bookings/BookingPayoutPendingBanner";
import {
  isPayoutReleasePending,
  vendorCancellationShareLine,
} from "@/features/bookings/bookingConfirmCopy";
import {
  cancellationPolicyLabel,
  cancellationPolicyTiers,
} from "@/features/bookings/cancellationPolicyCopy";
import { formatGbp } from "@/lib/money";
import { ReceiptActions } from "@/features/receipts/ReceiptActions";
import { hasPaymentReceipt } from "@/lib/receiptsApi";
import type { VendorBookingDetail } from "@/lib/vendorBookingsApi";

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
      {detail.date_change_declined ? (
        <div className="ez-banner ez-banner--warning">
          <div className="ez-banner__body">
            <div className="ez-banner__title">The client declined the date change</div>
            <p className="ez-small" style={{ color: "inherit" }}>
              The event stays on its original date. You can message them from this booking.
            </p>
          </div>
        </div>
      ) : null}

      {detail.price_update_declined ? (
        <div className="ez-banner ez-banner--warning">
          <div className="ez-banner__body">
            <div className="ez-banner__title">The client declined your new price</div>
            <p className="ez-small" style={{ color: "inherit" }}>
              The booking is still open at the original price. You can message them or send another price.
            </p>
          </div>
        </div>
      ) : null}

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

      <VendorBookingTermsNotices detail={detail} onChanged={onDetailChanged} showPaymentDeadline={false} />

      {isPayoutReleasePending(detail) ? (
        <BookingPayoutPendingBanner
          viewer="vendor"
          onRetryRelease={onRetryPayout}
          retryDisabled={actionBusy}
          retryLoading={actionBusy}
        />
      ) : null}

      {detail.booking_status === "cancelled" ? (
        <CancellationOutcome detail={detail} />
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

function CancellationOutcome({ detail }: { detail: VendorBookingDetail }) {
  const share = detail.cancellation_vendor_share_gbp ?? 0;
  const shareLabel = `${formatGbp(share)}`;
  const held = share > 0 && !detail.cancellation_payout_at;
  const policy = detail.cancellation_policy ?? "";
  const tiers = policy ? cancellationPolicyTiers(policy) : [];

  return (
    <div className="ez-stack ez-stack--lg">
      {held ? (
        <div className="ez-banner ez-banner--warning">
          <div className="ez-banner__body">
            <div className="ez-banner__title">Your share is held until payout setup is finished</div>
            <p className="ez-small" style={{ color: "inherit" }}>
              {vendorCancellationShareLine(shareLabel, detail.cancellation_payout_at)}
            </p>
          </div>
          <div className="ez-banner__actions">
            <Link className="ez-btn ez-btn--primary" href="/vendor/payments?tab=account">
              Complete payout setup
            </Link>
          </div>
        </div>
      ) : share > 0 ? (
        <div className="ez-banner ez-banner--success">
          <div className="ez-banner__body">
            <div className="ez-banner__title">Cancellation payout</div>
            <p className="ez-small" style={{ color: "inherit" }}>
              {vendorCancellationShareLine(shareLabel, detail.cancellation_payout_at)}
            </p>
          </div>
        </div>
      ) : null}

      <div className="ez-card">
        <div className="ez-card__head">
          <span className="ez-h3">How the money was split</span>
        </div>
        <div className="ez-card__body">
          <div className="ez-lines">
            {detail.cancellation_refund_percent != null ? (
              <div className="ez-lines__row">
                <span>Client refund</span>
                <span>{detail.cancellation_refund_percent}%</span>
              </div>
            ) : null}
            <div className="ez-lines__row">
              <span>Your share</span>
              <span>{share > 0 ? shareLabel : "£0.00"}</span>
            </div>
          </div>
        </div>
      </div>

      {tiers.length > 0 ? (
        <div className="ez-card">
          <div className="ez-card__head">
            <span className="ez-h3">Your cancellation policy</span>
            <span className="ez-badge ez-badge--neutral ez-badge--plain">{cancellationPolicyLabel(policy)}</span>
          </div>
          <div className="ez-card__body">
            <div className="ez-lines">
              {tiers.map((tier) => (
                <div className="ez-lines__row" key={tier.window}>
                  <span>{tier.window}</span>
                  <span>{tier.refund}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
