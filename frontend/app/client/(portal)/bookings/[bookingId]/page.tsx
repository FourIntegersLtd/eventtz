"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { ClientBookingsView } from "@/features/client/bookings/ClientBookingsView";

export default function ClientBookingDetailPage() {
  const params = useParams();
  const bookingId = typeof params.bookingId === "string" ? params.bookingId : "";
  return (
    <Suspense fallback={<p className="text-sm text-neutral-600">Loading…</p>}>
      <ClientBookingsView selectedBookingId={bookingId} />
    </Suspense>
  );
}
