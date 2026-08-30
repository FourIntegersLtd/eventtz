"use client";

import { useParams } from "next/navigation";
import { ClientPaymentReceiptView } from "@/features/receipts/ClientPaymentReceiptView";

export default function ClientBookingReceiptPage() {
  const params = useParams<{ bookingId: string }>();
  const bookingId = params.bookingId;
  if (!bookingId) return null;
  return <ClientPaymentReceiptView bookingId={bookingId} />;
}
