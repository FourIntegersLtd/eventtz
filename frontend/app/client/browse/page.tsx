"use client";

import { Suspense } from "react";
import { LoadingState } from "@/components/ui/LoadingState";
import { MarketplaceExploreView } from "@/features/marketplace/MarketplaceExploreView";

export default function ClientBrowsePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-auth-bg px-4 py-16">
          <LoadingState label="Loading browse…" variant="page" />
        </div>
      }
    >
        <MarketplaceExploreView />
    </Suspense>
  );
}
