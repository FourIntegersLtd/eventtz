"use client";

import { Suspense } from "react";
import { LoadingState } from "@/components/ui/LoadingState";
import { VendorPaymentsView } from "@/features/vendor/payments/VendorPaymentsView";

export default function VendorPaymentsPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading payments…" variant="centered" />}>
      <VendorPaymentsView />
    </Suspense>
  );
}
