"use client";

import { Suspense } from "react";
import { LoadingState } from "@/components/ui/LoadingState";
import { ClientSettingsEzView } from "@/features/settings/ClientSettingsEzView";

export default function ClientSettingsPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading settings…" variant="centered" />}>
      <ClientSettingsEzView />
    </Suspense>
  );
}
