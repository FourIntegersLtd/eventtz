"use client";

import Link from "next/link";
import { Card, Spinner } from "@/foundation/ui";
import { clientBookingHref } from "@/domains/client-bookings/checkoutReturn";
import { formatEventDate, paymentStatusLabel } from "@/domains/client-bookings/format";
import { useClientPayments } from "@/domains/client-bookings/useClientPayments";
import { hasPaymentReceipt } from "@/capabilities/receipt-links/receiptLinks";
import { ReceiptLink } from "@/capabilities/receipt-links/ReceiptLink";

/** `/client/payments` — bookings the client has already paid for, with receipt links. */
export function ClientPaymentsView() {
  const { bookings, loading, error } = useClientPayments();

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner label="Loading payment history…" />
      </div>
    );
  }

  if (error) {
    return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200/50">{error}</p>;
  }

  if (bookings.length === 0) {
    return (
      <Card>
        <p className="font-semibold text-neutral-900">No paid bookings yet</p>
        <p className="mt-1 text-sm text-neutral-600">When you pay for a booking, it will show up here.</p>
      </Card>
    );
  }

  return (
    <ul className="divide-y divide-neutral-100 overflow-hidden rounded-2xl bg-white shadow-lg shadow-primary/5 ring-1 ring-primary-border">
      {bookings.map((booking) => (
        <li key={booking.booking_request_id}>
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition hover:bg-neutral-50/80">
            <Link href={clientBookingHref(booking.booking_request_id)} className="min-w-0 flex-1">
              <p className="font-medium text-neutral-900">{booking.event_name}</p>
              <p className="mt-0.5 text-xs text-neutral-500">
                {booking.vendor_display_name}
                {booking.event_date ? ` · ${formatEventDate(booking.event_date)}` : ""}
              </p>
            </Link>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-sm font-semibold text-neutral-900 tabular-nums">
                {booking.client_total_label ?? booking.total_label}
              </span>
              <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary">
                {paymentStatusLabel(booking.payment_status)}
              </span>
              {hasPaymentReceipt(booking.payment_status) ? (
                <ReceiptLink
                  bookingId={booking.booking_request_id}
                  documentType="client_payment_receipt"
                  compact
                />
              ) : null}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
