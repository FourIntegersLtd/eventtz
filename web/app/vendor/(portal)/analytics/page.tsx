"use client";

import { Suspense } from "react";
import { LoadingState } from "@/components/ui/LoadingState";
import { VendorAnalyticsView } from "@/features/vendor/analytics/VendorAnalyticsView";

export default function VendorAnalyticsPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading analytics…" variant="centered" />}>
      <VendorAnalyticsView />
    </Suspense>
  );
}
