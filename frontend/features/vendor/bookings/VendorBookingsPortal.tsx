"use client";

import { Suspense } from "react";
import { VendorBookingsView } from "@/features/vendor/bookings/VendorBookingsView";

export function VendorBookingsPortal() {
  return (
    <Suspense fallback={<p className="text-sm text-neutral-600">Loading…</p>}>
      <VendorBookingsView />
    </Suspense>
  );
}
