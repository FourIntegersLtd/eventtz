"use client";

import { ReceiptPageShell } from "@/features/receipts/ReceiptPageShell";
import { fetchVendorPaymentRecord } from "@/lib/receiptsApi";

type VendorPaymentRecordViewProps = {
  bookingId: string;
};

export function VendorPaymentRecordView({ bookingId }: VendorPaymentRecordViewProps) {
  return (
    <ReceiptPageShell
      bookingId={bookingId}
      backHref={`/vendor/bookings/${bookingId}`}
      backLabel="Back to booking"
      load={fetchVendorPaymentRecord}
    />
  );
}
