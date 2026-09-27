import { Suspense } from "react";
import { Spinner } from "@/foundation/ui";
import { MarketplaceExploreView } from "@/domains/marketplace/MarketplaceExploreView";

/**
 * `/client/browse` — the client marketplace browse screen.
 * Renders inside Suspense because `useMarketplaceExplore` reads
 * `useSearchParams`.
 */
export default function ClientBrowsePage() {
  return (
    <Suspense fallback={<Spinner label="Loading browse…" />}>
      <MarketplaceExploreView mode="browse" />
    </Suspense>
  );
}
