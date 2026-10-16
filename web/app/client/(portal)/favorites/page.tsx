"use client";

import { Suspense } from "react";
import { LoadingState } from "@/components/ui/LoadingState";
import { MarketplaceExploreView } from "@/features/marketplace/MarketplaceExploreView";

export default function ClientFavoritesPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading favorites…" variant="centered" />}>
      <MarketplaceExploreView mode="favorites" embedded />
    </Suspense>
  );
}
