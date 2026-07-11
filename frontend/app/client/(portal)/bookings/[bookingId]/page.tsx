"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { LoadingState } from "@/components/ui/LoadingState";
import { ClientBookingsView } from "@/features/client/bookings/ClientBookingsView";

export default function ClientBookingDetailPage() {
  const params = useParams();
  const bookingId = typeof params.bookingId === "string" ? params.bookingId : "";
  return (
    <Suspense fallback={<LoadingState label="Loading booking…" variant="centered" />}>
      <ClientBookingsView selectedBookingId={bookingId} />
    </Suspense>
  );
}
