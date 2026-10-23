"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { ReceiptPageShell } from "@/features/receipts/ReceiptPageShell";
import { fetchClientPaymentReceipt } from "@/lib/receiptsApi";

type ClientPaymentReceiptViewProps = {
  bookingId: string;
};

export function ClientPaymentReceiptView({ bookingId }: ClientPaymentReceiptViewProps) {
  return (
    <div className="ez-stack ez-stack--lg">
      <PageHeader title="Receipt" />
      <ReceiptPageShell
        bookingId={bookingId}
        backHref={`/client/bookings/${bookingId}`}
        backLabel="Back to booking"
        load={fetchClientPaymentReceipt}
      />
    </div>
  );
}
