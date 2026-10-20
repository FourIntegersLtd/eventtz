"use client";

import { Suspense } from "react";
import { LoadingState } from "@/components/ui/LoadingState";
import { VendorDashboardView } from "@/features/vendor/dashboard/VendorDashboardView";

export default function VendorDashboardPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading dashboard…" variant="centered" />}>
      <VendorDashboardView />
    </Suspense>
  );
}
