"use client";

import { Suspense } from "react";
import { MarketplaceExploreView } from "@/features/marketplace/MarketplaceExploreView";

export default function ClientFavoritesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-neutral-600">Loading favorites…</p>}>
      <MarketplaceExploreView mode="favorites" embedded />
    </Suspense>
  );
}
