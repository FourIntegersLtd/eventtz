import { Suspense } from "react";
import { Spinner } from "@/foundation/ui";
import { MarketplaceExploreView } from "@/domains/marketplace/MarketplaceExploreView";

/**
 * `/client/favorites` — the client's saved vendors list.
 * Renders inside Suspense because `useMarketplaceExplore` reads
 * `useSearchParams`.
 */
export default function ClientFavoritesPage() {
  return (
    <Suspense fallback={<Spinner label="Loading favorites…" />}>
      <MarketplaceExploreView mode="favorites" />
    </Suspense>
  );
}
