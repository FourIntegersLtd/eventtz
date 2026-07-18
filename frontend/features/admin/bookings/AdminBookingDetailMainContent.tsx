"use client";

import {
  BookingPricingBreakdown,
  type BookingLineItemRow,
  type BookingPricing,
} from "@/features/bookings/BookingPricingBreakdown";
import { BookingReviewPanel } from "@/features/reviews/BookingReviewPanel";
import type { BookingReviewDisplay } from "@/lib/reviewTypes";
import {
  DetailSection,
  ExpandableId,
  Field,
  formatTs,
} from "./AdminBookingDetailShared";

type Props = {
  booking: Record<string, unknown>;
  lineItems: BookingLineItemRow[];
  pricing: BookingPricing | null;
  quoteTotalLabel: string;
  reviewVendor: BookingReviewDisplay | null;
};

export function AdminBookingDetailMainContent({
  booking,
  lineItems,
  pricing,
  quoteTotalLabel,
  reviewVendor,
}: Props) {
  return (
    <div className="min-w-0 space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <DetailSection title="Booking">
          <dl className="space-y-3">
            <Field label="Event date" value={String(booking.event_date ?? "—")} />
            <Field
              label="Postcode"
              value={booking.event_postcode != null ? String(booking.event_postcode) : "—"}
            />
            <Field label="Paid" value={formatTs(booking.paid_at)} />
            <Field label="Created" value={formatTs(booking.created_at)} />
          </dl>
        </DetailSection>

        <DetailSection title="People">
          <dl className="space-y-3">
            <Field label="Client" value={String(booking.client_email ?? "—")} />
            <Field label="Vendor" value={String(booking.vendor_display_name ?? "—")} />
            <Field label="Vendor email" value={String(booking.vendor_email ?? "—")} />
          </dl>
        </DetailSection>
      </div>

      <DetailSection title="Pricing">
        <BookingPricingBreakdown
          quoteTotalLabel={quoteTotalLabel}
          pricing={pricing}
          variant="client"
          lineItems={lineItems}
        />
      </DetailSection>

      <div className="grid gap-5 md:grid-cols-2">
        <DetailSection title="Payment">
          <dl className="space-y-3">
            <Field
              label="Amount"
              value={
                booking.payment_amount_gbp != null
                  ? `£${Number(booking.payment_amount_gbp).toFixed(2)}`
                  : "—"
              }
            />
            <Field
              label="Payment intent"
              value={<ExpandableId value={booking.stripe_payment_intent_id} label="payment intent" />}
            />
            <Field
              label="Charge"
              value={<ExpandableId value={booking.stripe_charge_id} label="charge" />}
            />
            <Field
              label="Checkout session"
              value={
                <ExpandableId value={booking.stripe_checkout_session_id} label="checkout session" />
              }
            />
          </dl>
        </DetailSection>

        <DetailSection title="Completion & payout">
          <dl className="space-y-3">
            <Field label="Client confirmed" value={formatTs(booking.client_completion_confirmed_at)} />
            <Field label="Vendor confirmed" value={formatTs(booking.vendor_completion_confirmed_at)} />
            <Field label="Payout sent" value={formatTs(booking.payout_released_at)} />
            <Field
              label="Transfer"
              value={<ExpandableId value={booking.stripe_transfer_id} label="transfer" />}
            />
          </dl>
        </DetailSection>
      </div>

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
