"use client";

import { ReceiptPageShell } from "@/domains/receipts/ReceiptPageShell";
import { fetchClientReceipt } from "@/domains/receipts/api";

/** `/client/bookings/[bookingId]/receipt` — the client's payment receipt. */
export function ClientReceiptView({ bookingId }: { bookingId: string }) {
  return (
    <ReceiptPageShell
      bookingId={bookingId}
      backHref={`/client/bookings/${bookingId}`}
      backLabel="Back to booking"
      load={fetchClientReceipt}
    />
  );
}
