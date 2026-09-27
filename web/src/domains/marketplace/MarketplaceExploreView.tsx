"use client";

import { useMarketplaceExplore } from "./useMarketplaceExplore";
import { MarketplaceVendorCard, marketplaceVendorCardGridClass } from "./MarketplaceVendorCard";
import { MarketplacePagination } from "./MarketplacePagination";
import { buildClientBrowseVendorUrl, MARKETPLACE_PAGE_SIZE } from "./marketplaceSearchParams";
import { Spinner } from "@/foundation/ui";

/**
 * Browse / favorites marketplace view.
 * - mode="browse": the full explore search screen.
 * - mode="favorites": lists only saved vendors; unsaving removes the card.
 *
 * Note: filters bar is omitted for now — filter state still drives the URL
 * and search params. The filters UI will be restored in a follow-up.
 */
export function MarketplaceExploreView({
  mode = "browse",
}: {
  mode?: "browse" | "favorites";
}) {
  const explore = useMarketplaceExplore(mode);
  const {
    state,
    loading,
    error,
    totalCount,
    headline,
    isSaved,
    toggle,
    bookmarkError,
    goToPage,
    visibleCards,
    exactCards,
    alsoConsiderCards,
  } = explore;

  const savedOnly = mode === "favorites";

  const pagination =
    !loading && !error && totalCount > MARKETPLACE_PAGE_SIZE ? (
      <MarketplacePagination
        page={state.page}
        totalCount={totalCount}
        pageSize={MARKETPLACE_PAGE_SIZE}
        onPageChange={goToPage}
      />
    ) : null;

  // --- Loading -----------------------------------------------------------
  if (loading) {
    return (
      <div className="py-12">
        <Spinner label="Loading vendors…" />
      </div>
    );
  }

  // --- Error -------------------------------------------------------------
  if (error) {
    return (
      <div className="py-12">
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  // --- Bookmark error (inline instead of toast) -------------------------
  const bookmarkErrorBanner = bookmarkError ? (
    <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
      {bookmarkError}
    </p>
  ) : null;

  // --- Empty state -------------------------------------------------------
  if (visibleCards.length === 0) {
    return (
      <div className="py-12">
        {bookmarkErrorBanner}
        <div className="text-center">
          <p className="text-lg font-semibold text-neutral-900">
            {savedOnly ? "No saved vendors" : "No vendors found"}
          </p>
          <p className="mt-2 text-sm text-neutral-500">
            {savedOnly
              ? "Save vendors while browsing to see them here."
              : "Try adjusting your filters or search for something different."}
          </p>
        </div>
      </div>
    );
  }

  // --- Results ----------------------------------------------------------
  return (
    <div>
      {bookmarkErrorBanner}

      {/* Headline */}
      {headline ? (
        <p className="mt-4 text-sm font-medium text-neutral-600">
          {headline} &middot; {totalCount} vendor{totalCount !== 1 ? "s" : ""}
        </p>
      ) : null}

      {/* Exact matches */}
      {exactCards.length > 0 ? (
        <div className={`mt-5 ${marketplaceVendorCardGridClass}`}>
          {exactCards.map((card) => (
            <MarketplaceVendorCard
              key={card.cardKey}
              card={card}
              vendorDetailHref={buildClientBrowseVendorUrl(card.vendor.user_id, state)}
              bookmarked={isSaved(card.vendor.user_id)}
              onToggleBookmark={() => toggle(card.vendor.user_id)}
            />
          ))}
        </div>
      ) : null}

      {/* Also consider */}
      {alsoConsiderCards.length > 0 ? (
        <div>
          <div className="mb-4 mt-8 border-t border-neutral-200 pt-6">
            <p className="text-sm font-semibold text-neutral-900">Also consider</p>
          </div>
          <div className={marketplaceVendorCardGridClass}>
            {alsoConsiderCards.map((card) => (
              <MarketplaceVendorCard
                key={card.cardKey}
                card={card}
                vendorDetailHref={buildClientBrowseVendorUrl(card.vendor.user_id, state)}
                bookmarked={isSaved(card.vendor.user_id)}
                onToggleBookmark={() => toggle(card.vendor.user_id)}
              />
            ))}
          </div>
        </div>
      ) : null}

      {pagination}
    </div>
  );
}
