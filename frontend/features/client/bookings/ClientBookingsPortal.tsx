"use client";

import { Suspense } from "react";
import { ClientBookingsView } from "@/features/client/bookings/ClientBookingsView";

export function ClientBookingsPortal() {
  return (
    <Suspense fallback={<p className="text-sm text-neutral-600">Loading…</p>}>
      <ClientBookingsView />
    </Suspense>
  );
}
