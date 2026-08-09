"use client";

import { Suspense } from "react";
import { LoadingState } from "@/components/ui/LoadingState";
import { ClientVendorBrowseDetailView } from "@/features/client/browse/ClientVendorBrowseDetailView";

export default function ClientVendorDetailPage() {
  return (
    <Suspense
      fallback={
        <LoadingState label="Loading vendor…" variant="centered" branded />
      }
    >
      <ClientVendorBrowseDetailView />
    </Suspense>
  );
}
