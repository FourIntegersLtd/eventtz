"use client";

import { Suspense } from "react";
import { LoadingState } from "@/components/ui/LoadingState";
import { ClientBookingsView } from "@/features/client/bookings/ClientBookingsView";

export function ClientBookingsPortal() {
  return (
    <Suspense fallback={<LoadingState label="Loading bookings…" variant="centered" />}>
      <ClientBookingsView />
    </Suspense>
  );
}
