"use client";

import { ReceiptPageShell } from "@/features/receipts/ReceiptPageShell";
import { fetchClientPaymentReceipt } from "@/lib/receiptsApi";

type ClientPaymentReceiptViewProps = {
  bookingId: string;
};

export function ClientPaymentReceiptView({ bookingId }: ClientPaymentReceiptViewProps) {
  return (
    <ReceiptPageShell
      bookingId={bookingId}
      backHref={`/client/bookings/${bookingId}`}
      backLabel="Back to booking"
      load={fetchClientPaymentReceipt}
    />
  );
}
