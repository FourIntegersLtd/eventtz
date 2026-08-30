"use client";

import { ReceiptPageShell } from "@/features/receipts/ReceiptPageShell";
import { fetchVendorPayoutStatement } from "@/lib/receiptsApi";

type VendorPayoutStatementViewProps = {
  bookingId: string;
};

export function VendorPayoutStatementView({ bookingId }: VendorPayoutStatementViewProps) {
  return (
    <ReceiptPageShell
      bookingId={bookingId}
      backHref={`/vendor/bookings/${bookingId}`}
      backLabel="Back to booking"
      load={fetchVendorPayoutStatement}
    />
  );
}
