"use client";

import { Suspense } from "react";
import { LoadingState } from "@/components/ui/LoadingState";
import { ClientVendorBrowseDetailView } from "@/features/client/browse/ClientVendorBrowseDetailView";

export default function ClientVendorDetailPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-auth-bg px-4 py-10">
          <LoadingState label="Loading vendor…" variant="page" />
        </main>
      }
    >
      <ClientVendorBrowseDetailView />
    </Suspense>
  );
}
