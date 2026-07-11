"use client";

import { Suspense } from "react";
import { MarketplaceExploreView } from "@/features/marketplace/MarketplaceExploreView";

export default function ClientBrowsePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f5f2f8] px-4 py-16 text-center text-neutral-600">
          Loading browse…
        </div>
      }
    >
        <MarketplaceExploreView />
    </Suspense>
  );
}
