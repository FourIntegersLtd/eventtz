"use client";

import { Suspense } from "react";
import { LoadingState } from "@/components/ui/LoadingState";
import { VendorSettingsEzView } from "@/features/settings/VendorSettingsEzView";

export default function VendorSettingsPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading settings…" variant="centered" />}>
      <VendorSettingsEzView />
    </Suspense>
  );
}
