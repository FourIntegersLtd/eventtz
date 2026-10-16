"use client";

import { useParams } from "next/navigation";
import { ClientBookingPayView } from "@/features/client/payments/ClientBookingPayView";

export default function ClientBookingPayPage() {
  const params = useParams<{ bookingId: string }>();
  const bookingId = params.bookingId;
  if (!bookingId) return null;
  return <ClientBookingPayView bookingId={bookingId} />;
}
