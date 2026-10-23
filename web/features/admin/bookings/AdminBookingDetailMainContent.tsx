"use client";

import { DescriptionList } from "@/components/ui/DescriptionList";
import { StatusBadge } from "@/components/badges/StatusBadge";
import { PaymentStatusBadge } from "@/components/badges/PaymentStatusBadge";
import type { BookingLineItemRow, BookingPricing } from "@/features/bookings/BookingPricingBreakdown";
import { BookingReviewPanel } from "@/features/reviews/BookingReviewPanel";
import type { BookingReviewDisplay } from "@/lib/reviewTypes";
import { AdminBookingTimeline } from "./AdminBookingTimeline";
import {
  buildPaymentLifecycleTimeline,
  buildRequestLifecycleTimeline,
} from "./adminBookingLifecycle";
import { DetailSection, ExpandableId, formatTs } from "./AdminBookingDetailShared";
import { formatGbp } from "@/lib/money";

type Props = {
  booking: Record<string, unknown>;
  lineItems: BookingLineItemRow[];
  pricing: BookingPricing | null;
  quoteTotalLabel: string;
  reviewVendor: BookingReviewDisplay | null;
};

function moneyLines(pricing: BookingPricing | null, quoteTotalLabel: string) {
  if (!pricing) {
    return (
      <div className="ez-lines">
        <div className="ez-lines__row">
          <span>Total</span>
          <span>{quoteTotalLabel}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="ez-lines">
      {pricing.line_items_subtotal_label ? (
        <div className="ez-lines__row">
          <span>Vendor quote</span>
          <span>{pricing.line_items_subtotal_label}</span>
        </div>
      ) : null}
      {pricing.service_fee_label ? (
        <div className="ez-lines__row">
          <span>Service fee (client)</span>
          <span>{pricing.service_fee_label}</span>
        </div>
      ) : null}
      <div className="ez-lines__total">
        <span>Client pays</span>
        <span>{quoteTotalLabel}</span>
      </div>
      {pricing.vendor_portion_label ? (
        <div className="ez-lines__row">
          <span>Vendor payout</span>
          <span>{pricing.vendor_portion_label}</span>
        </div>
      ) : null}
    </div>
  );
}

export function AdminBookingDetailMainContent({
  booking,
  lineItems,
  pricing,
  quoteTotalLabel,
  reviewVendor,
}: Props) {
  const requestTimeline = buildRequestLifecycleTimeline(booking);
  const paymentTimeline = buildPaymentLifecycleTimeline(booking);
  const status = String(booking.status ?? "");
  const paymentStatus = String(booking.payment_status ?? "unpaid");

  return (
    <div className="ez-stack ez-stack--lg min-w-0">
      <DetailSection title="Request lifecycle">
        <div className="ez-between" style={{ marginBottom: "12px" }}>
          <span className="ez-small">Booking request status</span>
          <StatusBadge status={status} />
        </div>
        <AdminBookingTimeline items={requestTimeline} />
      </DetailSection>

      <DetailSection title="Payment lifecycle">
        <div className="ez-between" style={{ marginBottom: "12px" }}>
          <span className="ez-small">Money status</span>
          <PaymentStatusBadge status={paymentStatus} />
        </div>
        <AdminBookingTimeline items={paymentTimeline} />
      </DetailSection>

      <DetailSection title="Money breakdown">{moneyLines(pricing, quoteTotalLabel)}</DetailSection>

      {lineItems.length > 0 ? (
        <DetailSection title="Line items">
          <div className="ez-lines">
            {lineItems.map((line) => (
              <div key={line.id} className="ez-lines__row">
                <span>{line.heading}</span>
                <span>
                  {line.unit_price_gbp != null
                    ? formatGbp(line.unit_price_gbp, { decimals: 2 })
                    : "TBC"}
                </span>
              </div>
            ))}
          </div>
        </DetailSection>
      ) : null}

      <DetailSection title="Parties">
        <DescriptionList
          items={[
            { label: "Client", value: String(booking.client_email ?? "-") },
            { label: "Vendor", value: String(booking.vendor_display_name ?? "-") },
            { label: "Vendor email", value: String(booking.vendor_email ?? "-") },
            { label: "Event date", value: String(booking.event_date ?? "-") },
            {
              label: "Postcode",
              value: booking.event_postcode != null ? String(booking.event_postcode) : "-",
            },
            { label: "Paid", value: formatTs(booking.paid_at) },
            { label: "Payout sent", value: formatTs(booking.payout_released_at) },
          ]}
        />
      </DetailSection>

      <DetailSection title="Stripe references">
        <dl className="ez-dl">
          <dt>Checkout session</dt>
          <dd>
            <ExpandableId value={booking.stripe_checkout_session_id} label="checkout session" />
          </dd>
          <dt>Payment intent</dt>
          <dd>
            <ExpandableId value={booking.stripe_payment_intent_id} label="payment intent" />
          </dd>
          <dt>Charge</dt>
          <dd>
            <ExpandableId value={booking.stripe_charge_id} label="charge" />
          </dd>
          <dt>Transfer</dt>
          <dd>
            <ExpandableId value={booking.stripe_transfer_id} label="transfer" />
          </dd>
          <dt>Vendor Connect account</dt>
          <dd>
            <ExpandableId value={booking.vendor_stripe_account_id} label="vendor account" />
          </dd>
        </dl>
        <p className="ez-caption" style={{ marginTop: "12px" }}>
          Ids are masked. Open in Stripe for the full value.
        </p>
      </DetailSection>

      <DetailSection title="Review">
        <BookingReviewPanel
          title="Client review of vendor"
          review={reviewVendor}
          emptyLabel="No review yet."
        />
      </DetailSection>
    </div>
  );
}
