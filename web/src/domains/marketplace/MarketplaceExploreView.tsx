"use client";

import Link from "next/link";
import { useMarketplaceExplore } from "./useMarketplaceExplore";
import { MarketplaceFiltersBar } from "./MarketplaceFiltersBar";
import {
  MarketplaceVendorCard,
  marketplaceVendorCardGridClass,
} from "./MarketplaceVendorCard";
import { MarketplacePagination } from "./MarketplacePagination";
import {
  buildClientBrowseVendorUrl,
  buildMarketplaceSearchUrl,
  MARKETPLACE_PAGE_SIZE,
  type MarketplaceSearchState,
} from "./marketplaceSearchParams";
import { expandVendorsForSearchResults } from "./marketplaceSearchModel";
import { planOptionsLabel } from "./marketplacePlanCopy";
import type { ExploreSearchSection } from "./api";
import { Spinner } from "@/foundation/ui";

function planSeeMoreHref(
  pathname: string,
  searchState: MarketplaceSearchState,
  section: ExploreSearchSection,
): string {
  return buildMarketplaceSearchUrl(pathname, {
    ...searchState,
    query: "",
    types: [section.service_key],
    page: 1,
  });
}

/**
 * Browse / favorites marketplace view.
 * Browse includes filters, plan mode, and exact / also-consider splits.
 * Favorites is a single paginated grid.
 */
export function MarketplaceExploreView({
  mode = "browse",
}: {
  mode?: "browse" | "favorites";
}) {
  const explore = useMarketplaceExplore(mode);
  const {
    pathname,
    state,
    loading,
    error,
    totalCount,
    headline,
    isSaved,
    toggle,
    bookmarkError,
    commit,
    goToPage,
    visibleCards,
    exactCards,
    alsoConsiderCards,
    savedOnly,
    isPlanMode,
    plan,
    sections,
    matchNotice,
    displayCount,
  } = explore;

  const pagination =
    !loading && !error && !isPlanMode && totalCount > MARKETPLACE_PAGE_SIZE ? (
      <MarketplacePagination
        page={state.page}
        totalCount={totalCount}
        pageSize={MARKETPLACE_PAGE_SIZE}
        onPageChange={goToPage}
      />
    ) : null;

  const bookmarkErrorBanner = bookmarkError ? (
    <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
      {bookmarkError}
    </p>
  ) : null;

  const resultsBody = loading ? (
    <div className="mt-6 py-12">
      <Spinner label="Loading vendors…" />
    </div>
  ) : error ? (
    <p className="mt-6 text-sm text-red-700">{error}</p>
  ) : visibleCards.length === 0 && !isPlanMode ? (
    <div className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-12 text-center">
      <p className="text-lg font-semibold text-neutral-900">
        {savedOnly ? "No saved vendors yet" : "No vendors match these filters"}
      </p>
      <p className="mt-2 text-sm text-neutral-600">
        {savedOnly
          ? "Tap the heart on a vendor card to save them here."
          : "Try widening your search or clearing a filter."}
      </p>
    </div>
  ) : savedOnly ? (
    <>
      <div className={`mt-6 ${marketplaceVendorCardGridClass}`}>
        {visibleCards.map((card) => (
          <MarketplaceVendorCard
            key={card.cardKey}
            card={card}
            vendorDetailHref={buildClientBrowseVendorUrl(card.vendor.user_id, state)}
            bookmarked={isSaved(card.vendor.user_id)}
            onToggleBookmark={() => toggle(card.vendor.user_id)}
          />
        ))}
      </div>
      {pagination}
    </>
  ) : isPlanMode ? (
    <div className="mt-6 space-y-10">
      {state.query.trim() ? (
        <div className="rounded-xl border border-primary/15 bg-[#faf8fc] px-4 py-3 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <p className="text-sm text-neutral-700">
            Want a full celebration plan with budget and ranked picks?
          </p>
          <Link
            href={`/client/planner?q=${encodeURIComponent(state.query.trim())}`}
            className="mt-2 inline-flex text-sm font-semibold text-primary hover:underline sm:mt-0"
          >
            Open full celebration plan
          </Link>
        </div>
      ) : null}
      {sections.map((section) => {
        const sectionCards = expandVendorsForSearchResults(section.vendors ?? [], [
          section.service_key,
        ]);
        return (
          <section
            key={section.need_id}
            id={`plan-need-${section.need_id}`}
            className="scroll-mt-24"
          >
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold tracking-tight text-neutral-900">
                  {section.label}
                  {section.optional ? (
                    <span className="ml-2 text-sm font-medium text-neutral-500">Optional</span>
                  ) : null}
                </h2>
                <p className="mt-0.5 text-xs font-medium text-neutral-500">
                  {planOptionsLabel(section.total_count)}
                </p>
              </div>
              {section.total_count > (section.vendors?.length ?? 0) ? (
                <Link
                  href={planSeeMoreHref(pathname, state, section)}
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  See more
                </Link>
              ) : null}
            </div>
            {sectionCards.length === 0 ? (
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-8 text-center">
                <p className="font-semibold text-neutral-900">No vendors for this yet</p>
                <p className="mt-1 text-sm text-neutral-600">
                  Try another category or check back as we add more vendors.
                </p>
              </div>
            ) : (
              <div className={marketplaceVendorCardGridClass}>
                {sectionCards.map((card) => (
                  <MarketplaceVendorCard
                    key={`${section.need_id}-${card.cardKey}`}
                    card={card}
                    vendorDetailHref={buildClientBrowseVendorUrl(card.vendor.user_id, state)}
                    bookmarked={isSaved(card.vendor.user_id)}
                    onToggleBookmark={() => toggle(card.vendor.user_id)}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  ) : (
    <div className="mt-6 space-y-8">
      {matchNotice ? (
        <p className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-neutral-800">
          {matchNotice}
        </p>
      ) : null}

      {exactCards.length > 0 ? (
        <div className={marketplaceVendorCardGridClass}>
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

      {alsoConsiderCards.length > 0 ? (
        <div>
          <div className="mb-4 border-t border-neutral-200 pt-6">
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

  return (
    <div>
      {!savedOnly ? (
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-neutral-900 sm:text-3xl">Find vendors</h1>
        </div>
      ) : null}

      {bookmarkErrorBanner}

      {!savedOnly ? (
        <MarketplaceFiltersBar state={state} onCommit={commit} />
      ) : null}

      {state.fromPlannerPlanId && !loading ? (
        <div className="mt-4 rounded-xl border border-primary/15 bg-[#faf8fc] px-4 py-3 text-sm text-neutral-800">
          From your celebration plan — open a vendor to pick packages.
        </div>
      ) : null}

      <div className="mt-6">
        <p className="text-sm font-semibold text-neutral-900">
          {loading ? (
            <span className="inline-flex items-center gap-2 text-neutral-500">Loading…</span>
          ) : isPlanMode ? (
            `${displayCount} vendor${displayCount === 1 ? "" : "s"}`
          ) : (
            `${displayCount} result${displayCount === 1 ? "" : "s"}`
          )}
        </p>
        {!savedOnly && headline ? (
          <p className="mt-1 text-sm text-neutral-600">{headline}</p>
        ) : null}
        {isPlanMode && plan?.needs?.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {plan.needs.map((need) => (
              <a
                key={need.id}
                href={`#plan-need-${need.id}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-700 hover:border-primary/40 hover:text-primary"
              >
                {need.label}
                {need.optional ? <span className="text-neutral-400">optional</span> : null}
              </a>
            ))}
          </div>
        ) : null}
      </div>

      {resultsBody}
    </div>
  );
}
