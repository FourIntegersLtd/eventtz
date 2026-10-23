"use client";

import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
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
        <Banner tone="warning" title="The client declined the date change">
          The event stays on its original date. You can message them from this booking.
        </Banner>
      ) : null}

      {detail.price_update_declined ? (
        <Banner tone="warning" title="The client declined your new price">
          The booking is still open at the original price. You can message them or send another price.
        </Banner>
      ) : null}

      {detail.booking_status === "accepted" && detail.payment_status === "unpaid" ? (
        <div className="rounded-2xl border border-line bg-surface-3 px-5 py-4">
          <p className="text-sm font-semibold text-ink">Waiting on the client&apos;s payment</p>
          <p className="mt-1 text-[13px] text-ink-2">
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
        <Banner
          tone="warning"
          title="Your share is held until payout setup is finished"
          action={<ButtonLink href="/vendor/payments?tab=account">Complete payout setup</ButtonLink>}
        >
          {vendorCancellationShareLine(shareLabel, detail.cancellation_payout_at)}
        </Banner>
      ) : share > 0 ? (
        <Banner tone="success" title="Cancellation payout">
          {vendorCancellationShareLine(shareLabel, detail.cancellation_payout_at)}
        </Banner>
      ) : null}

      <Card>
        <Card.Header>
          <span className="ez-h3">How the money was split</span>
        </Card.Header>
        <Card.Body>
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
        </Card.Body>
      </Card>

      {tiers.length > 0 ? (
        <Card>
          <Card.Header>
            <span className="ez-h3">Your cancellation policy</span>
            <Badge className="ez-badge--plain">{cancellationPolicyLabel(policy)}</Badge>
          </Card.Header>
          <Card.Body>
            <div className="ez-lines">
              {tiers.map((tier) => (
                <div className="ez-lines__row" key={tier.window}>
                  <span>{tier.window}</span>
                  <span>{tier.refund}</span>
                </div>
              ))}
            </div>
          </Card.Body>
        </Card>
      ) : null}
    </div>
  );
}
