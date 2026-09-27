"use client";

import { Card, Spinner } from "@/foundation/ui";
import { useVendorBookingDetail } from "@/domains/vendor-bookings/useVendorBookingDetail";
import { bookingStatusLabel, formatEventDate, formatGbp, initiatorLabel, paymentStatusLabel } from "@/domains/vendor-bookings/format";
import { toDisplayLineItem } from "@/domains/vendor-bookings/lineItems";
import { BookingStatusActions } from "@/domains/vendor-bookings/BookingStatusActions";
import { AdjustmentsForm } from "@/domains/vendor-bookings/AdjustmentsForm";
import { BookingDisputesPanel } from "@/domains/vendor-bookings/BookingDisputesPanel";
import { hasPaymentReceipt } from "@/capabilities/receipt-links/receiptLinks";
import { ReceiptLink } from "@/capabilities/receipt-links/ReceiptLink";

/** `/vendor/bookings/[bookingId]` — one booking's full detail, with its status and pricing actions. */
export function BookingDetailView({ bookingId }: { bookingId: string }) {
  const {
    booking,
    loading,
    loadError,
    actionError,
    pendingAction,
    accept,
    decline,
    withdraw,
    cancel,
    confirmCompletion,
    saveAdjustments,
  } = useVendorBookingDetail(bookingId);

  if (loading) return <Spinner label="Loading booking…" />;

  if (loadError || !booking) {
    return <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200/60">{loadError ?? "Booking not found."}</p>;
  }

  const canEditAdjustments = booking.booking_status === "pending" && booking.initiator === "client";

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">{booking.event_name}</h2>
            <p className="text-sm text-neutral-500">{formatEventDate(booking.event_date)}</p>
            <p className="mt-1 text-sm text-neutral-600">{booking.client_display_name ?? booking.client_email ?? "Client"}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold text-neutral-900">{booking.total_label}</p>
            <p className="text-xs font-medium text-primary">{bookingStatusLabel(booking.booking_status)}</p>
            <p className="mt-1 text-xs text-neutral-500">{paymentStatusLabel(booking.payment_status)}</p>
          </div>
        </div>

        <p className="mt-2 text-xs font-medium text-neutral-500">{initiatorLabel(booking.initiator)}</p>

        {booking.event_address || booking.event_postcode ? (
          <p className="mt-3 text-sm text-neutral-600">{[booking.event_address, booking.event_postcode].filter(Boolean).join(", ")}</p>
        ) : null}

        {booking.notes ? (
          <div className="mt-3 rounded-xl bg-neutral-50 p-3 text-sm text-neutral-700">
            <p className="text-xs font-medium text-neutral-500">Notes from client</p>
            <p className="mt-1 whitespace-pre-wrap">{booking.notes}</p>
          </div>
        ) : null}

        <div className="mt-4">
          <BookingStatusActions
            booking={booking}
            pendingAction={pendingAction}
            onAccept={accept}
            onDecline={decline}
            onWithdraw={withdraw}
            onCancel={cancel}
            onConfirmCompletion={confirmCompletion}
          />
        </div>

        {actionError ? (
          <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200/60">{actionError}</p>
        ) : null}

        {hasPaymentReceipt(booking.payment_status) ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <ReceiptLink bookingId={bookingId} documentType="vendor_payment_record" />
            {booking.payment_status === "payout_released" ? (
              <ReceiptLink bookingId={bookingId} documentType="vendor_payout_statement" />
            ) : null}
          </div>
        ) : null}
      </Card>

      <Card>
        <h3 className="font-semibold text-neutral-900">Line items</h3>
        <ul className="mt-3 space-y-2">
          {booking.line_items.map((rawItem, index) => {
            const item = toDisplayLineItem(rawItem, index);
            return (
              <li key={item.id} className="flex items-center justify-between text-sm">
                <span className="text-neutral-700">
                  {item.heading}
                  {item.quantity ? ` × ${item.quantity}${item.unitLabel ? ` ${item.unitLabel}` : ""}` : ""}
                </span>
                {item.unitPriceGbp !== null ? <span className="font-medium text-neutral-900">{formatGbp(item.unitPriceGbp)}</span> : null}
              </li>
            );
          })}
        </ul>

        {booking.vendor_adjustments && booking.vendor_adjustments.length > 0 ? (
          <div className="mt-4 space-y-2 border-t border-primary-border pt-3">
            {booking.vendor_adjustments.map((adjustment) => (
              <div key={adjustment.id} className="flex items-center justify-between text-sm">
                <span className="text-neutral-700">{adjustment.label}</span>
                <span className="font-medium text-neutral-900">{formatGbp(adjustment.amount_gbp)}</span>
              </div>
            ))}
          </div>
        ) : null}

        {booking.pricing ? (
          <div className="mt-4 space-y-1 border-t border-primary-border pt-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-neutral-600">Service fee</span>
              <span className="text-neutral-900">{booking.pricing.service_fee_label}</span>
            </div>
            <div className="flex items-center justify-between font-semibold">
              <span className="text-neutral-900">Client total</span>
              <span className="text-neutral-900">{booking.pricing.client_total_label}</span>
            </div>
            <div className="flex items-center justify-between text-neutral-600">
              <span>Your payout</span>
              <span>{booking.pricing.vendor_portion_label}</span>
            </div>
          </div>
        ) : null}
      </Card>

      {canEditAdjustments ? (
        <Card>
          <h3 className="font-semibold text-neutral-900">Add an extra cost or discount</h3>
          <p className="mt-1 text-sm text-neutral-500">The client will need to confirm the new price before paying.</p>
          <div className="mt-3">
            <AdjustmentsForm saving={pendingAction === "adjustments"} onSave={saveAdjustments} />
          </div>
        </Card>
      ) : null}

      <Card>
        <h3 className="font-semibold text-neutral-900">Disputes</h3>
        <div className="mt-3">
          <BookingDisputesPanel bookingId={bookingId} />
        </div>
      </Card>
    </div>
  );
}
