"use client";

import { ReceiptPageShell } from "@/domains/receipts/ReceiptPageShell";
import { fetchVendorPayoutStatement } from "@/domains/receipts/api";

/** `/vendor/bookings/[bookingId]/payout-statement` — vendor payout statement. */
export function VendorPayoutStatementView({ bookingId }: { bookingId: string }) {
  return (
    <ReceiptPageShell
      bookingId={bookingId}
      backHref={`/vendor/bookings/${bookingId}`}
      backLabel="Back to booking"
      load={fetchVendorPayoutStatement}
    />
  );
}
