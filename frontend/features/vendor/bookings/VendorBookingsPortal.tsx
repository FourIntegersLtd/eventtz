"use client";

import { Suspense } from "react";
import { LoadingState } from "@/components/ui/LoadingState";
import { VendorBookingsView } from "@/features/vendor/bookings/VendorBookingsView";

export function VendorBookingsPortal() {
  return (
    <Suspense fallback={<LoadingState label="Loading bookings…" variant="centered" />}>
      <VendorBookingsView />
    </Suspense>
  );
}
