"use client";

import {
  BookingPricingBreakdown,
  type BookingLineItemRow,
  type BookingPricing,
} from "@/features/bookings/BookingPricingBreakdown";
import { BookingReviewPanel } from "@/features/reviews/BookingReviewPanel";
import type { BookingReviewDisplay } from "@/lib/reviewTypes";
import { ExpandableId, Field, formatTs } from "./AdminBookingDetailShared";

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
    <div className="min-w-0 space-y-6">
      <section>
        <h2 className="text-[15px] font-semibold tracking-tight text-neutral-900">Overview</h2>
        <p className="mt-0.5 text-[13px] text-neutral-400">Booking, people, payment, and payout</p>
        <dl className="mt-3 divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-100 bg-white">
          <div className="grid gap-0 sm:grid-cols-2">
            <div className="space-y-3 px-5 py-4 sm:border-r sm:border-neutral-100">
              <Field label="Event date" value={String(booking.event_date ?? "—")} />
              <Field
                label="Postcode"
                value={booking.event_postcode != null ? String(booking.event_postcode) : "—"}
              />
              <Field label="Paid" value={formatTs(booking.paid_at)} />
            </div>
            <div className="space-y-3 border-t border-neutral-100 px-5 py-4 sm:border-t-0">
              <Field label="Client" value={String(booking.client_email ?? "—")} />
              <Field label="Vendor" value={String(booking.vendor_display_name ?? "—")} />
              <Field label="Vendor email" value={String(booking.vendor_email ?? "—")} />
            </div>
          </div>

          <div className="grid gap-0 sm:grid-cols-2">
            <div className="space-y-3 px-5 py-4 sm:border-r sm:border-neutral-100">
              <Field
                label="Amount"
                value={
                  booking.payment_amount_gbp != null
                    ? `£${Number(booking.payment_amount_gbp).toFixed(2)}`
                    : "—"
                }
              />
              <Field label="Client confirmed" value={formatTs(booking.client_completion_confirmed_at)} />
              <Field label="Vendor confirmed" value={formatTs(booking.vendor_completion_confirmed_at)} />
            </div>
            <div className="space-y-3 border-t border-neutral-100 px-5 py-4 sm:border-t-0">
              <Field label="Payout sent" value={formatTs(booking.payout_released_at)} />
              <details className="group">
                <summary className="cursor-pointer list-none text-[13px] font-medium text-primary hover:underline [&::-webkit-details-marker]:hidden">
                  Payment refs
                </summary>
                <div className="mt-3 space-y-3">
                  <Field
                    label="Payment intent"
                    value={
                      <ExpandableId
                        value={booking.stripe_payment_intent_id}
                        label="payment intent"
                      />
                    }
                  />
                  <Field
                    label="Charge"
                    value={<ExpandableId value={booking.stripe_charge_id} label="charge" />}
                  />
                  <Field
                    label="Checkout"
                    value={
                      <ExpandableId
                        value={booking.stripe_checkout_session_id}
                        label="checkout session"
                      />
                    }
                  />
                  <Field
                    label="Transfer"
                    value={<ExpandableId value={booking.stripe_transfer_id} label="transfer" />}
                  />
                </div>
              </details>
            </div>
          </div>
        </dl>
      </section>

      <section>
        <BookingPricingBreakdown
          quoteTotalLabel={quoteTotalLabel}
          pricing={pricing}
          variant="client"
          lineItems={lineItems}
        />
      </section>

      <section>
        <h2 className="text-[15px] font-semibold tracking-tight text-neutral-900">Review</h2>
        <div className="mt-3 overflow-hidden rounded-2xl border border-neutral-100 bg-white px-5 py-4">
          <BookingReviewPanel
            title="Client review of vendor"
            review={reviewVendor}
            emptyLabel="No review yet."
          />
        </div>
      </section>
    </div>
  );
}
