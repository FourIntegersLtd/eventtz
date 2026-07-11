"use client";

import { Suspense } from "react";
import { VendorPaymentsView } from "@/features/vendor/payments/VendorPaymentsView";

export default function VendorPaymentsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-neutral-600">Loading…</p>}>
      <VendorPaymentsView />
    </Suspense>
  );
}
