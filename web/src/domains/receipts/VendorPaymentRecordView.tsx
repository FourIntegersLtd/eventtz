"use client";

import { ReceiptPageShell } from "@/domains/receipts/ReceiptPageShell";
import { fetchVendorPaymentRecord } from "@/domains/receipts/api";

/** `/vendor/bookings/[bookingId]/payment-record` — vendor payment record. */
export function VendorPaymentRecordView({ bookingId }: { bookingId: string }) {
  return (
    <ReceiptPageShell
      bookingId={bookingId}
      backHref={`/vendor/bookings/${bookingId}`}
      backLabel="Back to booking"
      load={fetchVendorPaymentRecord}
    />
  );
}
