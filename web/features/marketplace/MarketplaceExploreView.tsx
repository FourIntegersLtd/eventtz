"use client";

import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import {
  buildClientBrowseVendorUrl,
  buildMarketplaceSearchUrl,
  type MarketplaceSearchState,
} from "@/lib/marketplaceSearchParams";
import { HeroMarketplaceSearch } from "@/features/marketplace/HeroMarketplaceSearch";
import { MarketplaceBrowseShell } from "@/features/marketplace/MarketplaceBrowseShell";
import { MarketplaceFiltersBar } from "@/features/marketplace/MarketplaceFiltersBar";
import { MarketplacePagination } from "@/features/marketplace/MarketplacePagination";
import { LoadingState } from "@/components/ui/LoadingState";
import { LottieEmptyPanel } from "@/components/ui/LottieEmptyPanel";
import { LottieFailureInline } from "@/components/ui/LottieFailureInline";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import {
  MarketplaceVendorCard,
  marketplaceVendorCardGridClass,
  marketplaceVendorCardGridItemClass,
} from "@/features/marketplace/MarketplaceVendorCard";
import { MotionStaggerItem } from "@/components/ui/MotionStaggerItem";
import { MultiVendorEnquireModal } from "@/features/marketplace/MultiVendorEnquireModal";
import { expandVendorsForSearchResults } from "@/features/marketplace/marketplaceSearchModel";
import { planOptionsLabel } from "@/features/marketplace/marketplacePlanCopy";
import { ScrollToTopButton } from "@/components/ui/ScrollToTopButton";
import { useMarketplaceExplore } from "@/features/marketplace/useMarketplaceExplore";
import { useBrowseGeolocation } from "@/features/marketplace/useBrowseGeolocation";
import { CLIENT_BOOKING_TOAST_COPY } from "@/features/bookings/bookingConfirmCopy";
import type { ExploreSearchSection } from "@/lib/clientExploreApi";
import { MARKETPLACE_PAGE_SIZE } from "@/lib/marketplaceSearchParams";

const CARD_GRID = marketplaceVendorCardGridClass;
const CARD_GRID_ITEM = marketplaceVendorCardGridItemClass;

function planSeeMoreHref(
  pathname: string,
  state: MarketplaceSearchState,
  section: ExploreSearchSection,
): string {
  return buildMarketplaceSearchUrl(pathname, {
    ...state,
    query: "",
    types: [section.service_key],
    page: 1,
  });
}

export function MarketplaceExploreView({
  mode = "browse",
  embedded = false,
}: {
  mode?: "browse" | "favorites";
  embedded?: boolean;
}) {
  const { showToast } = useToast();
  const explore = useMarketplaceExplore(mode);
  const {
    pathname,
    router,
    state,
    fetchKey,
    loading,
    error,
    plan,
    sections,
    selectedVendors,
    selectedCount,
    clearSelection,
    multiEnquireOpen,
    setMultiEnquireOpen,
    isSaved,
    toggle,
    savedOnly,
    searchPrefill,
    planEventPrefill,
    multiEnquireContext,
    commitFilters,
    onVendorNavigate,
    openMultiEnquire,
    goToPage,
    headline,
    isPlanMode,
    visibleCards,
    displayCount,
    exactCards,
    alsoConsiderCards,
    cardSelectProps,
    launchingSoonModal,
    totalCount,
    matchNotice,
  } = explore;

  const geo = useBrowseGeolocation({
    state,
    onCommit: commitFilters,
    enabled: !savedOnly && mode === "browse",
  });

  const pagination =
    !loading && !error && !isPlanMode && totalCount > MARKETPLACE_PAGE_SIZE ? (
      <MarketplacePagination
        page={state.page}
        totalCount={totalCount}
        pageSize={MARKETPLACE_PAGE_SIZE}
        onPageChange={goToPage}
      />
    ) : null;

  const selectionBar =
    explore.isClient && selectedCount > 0 ? (
      <div
        className={`sticky z-30 mx-auto mt-6 flex max-w-xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-white px-4 py-3 shadow-lg ring-1 ring-primary/10 ${
          embedded
            ? "bottom-[calc(1rem+5.5rem+env(safe-area-inset-bottom,0px))] md:bottom-4"
            : "bottom-4"
        }`}
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-900">{selectedCount} selected</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={clearSelection}>
            Clear
          </Button>
          <Button variant="primary" size="sm" onClick={openMultiEnquire} disabled={selectedCount < 1}>
            Message {selectedCount} together
          </Button>
        </div>
      </div>
    ) : null;

  const filtersAndResults = (
    <div className="w-full min-w-0">
      <HeroMarketplaceSearch
        key={fetchKey}
        variant="default"
        submitToPath={savedOnly ? "/client/favorites" : pathname}
        initialState={state}
        submitMode="replace"
        showTypesField={false}
        showDatesField
      />

      {!savedOnly ? (
        <MarketplaceFiltersBar
          state={state}
          onCommit={commitFilters}
          onRequestCurrentLocation={geo.requestCurrentLocation}
          geoLoading={geo.loading}
          geoError={geo.error}
          onClearGeoError={geo.clearError}
        />
      ) : null}

      {state.fromPlannerPlanId && !loading ? (
        <div className="mt-4 rounded-xl border border-primary/15 bg-[#faf8fc] px-4 py-3 text-sm text-neutral-800">
          From your celebration plan - open a vendor to pick packages, or select several and
          message them together.
        </div>
      ) : null}

      <div className="mt-6">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-900">
            {loading ? (
              <span className="inline-flex items-center gap-1.5">
                <LoadingSpinner size="sm" className="text-neutral-400" />
                Loading…
              </span>
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
      </div>

      {loading ? (
        <LoadingState label="Loading vendors…" variant="centered" className="mt-6 py-12" branded />
      ) : error ? (
        <LottieFailureInline message={error} className="mt-6" />
      ) : visibleCards.length === 0 && !isPlanMode ? (
        <LottieEmptyPanel
          className="mt-6"
          variant={savedOnly ? "favorites" : "vendors"}
          title={savedOnly ? "No saved vendors yet" : "No vendors match these filters"}
          description={
            savedOnly
              ? "Tap the heart on a vendor card to save them here."
              : "Try widening your search or clearing a filter."
          }
        />
      ) : savedOnly ? (
        <>
          <div className={`mt-6 ${CARD_GRID}`}>
            {visibleCards.map((card, index) => (
              <MotionStaggerItem key={card.cardKey} index={index} className={CARD_GRID_ITEM}>
                <MarketplaceVendorCard
                  card={card}
                  vendorDetailHref={buildClientBrowseVendorUrl(card.vendor.user_id, state)}
                  bookmarked={isSaved(card.vendor.user_id)}
                  onToggleBookmark={() => toggle(card.vendor.user_id)}
                  onNavigate={onVendorNavigate}
                  {...cardSelectProps(card.vendor)}
                />
              </MotionStaggerItem>
            ))}
          </div>
          {pagination}
          {selectionBar}
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
            const sectionCards = expandVendorsForSearchResults(
              section.vendors,
              [section.service_key],
            );
            return (
              <section
                key={section.need_id}
                id={`plan-need-${section.need_id}`}
                className="scroll-mt-24"
              >
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-heading text-lg font-semibold tracking-tight text-neutral-900">
                      {section.label}
                      {section.optional ? (
                        <span className="ml-2 text-sm font-medium text-neutral-500">Optional</span>
                      ) : null}
                    </h2>
                    <p className="mt-0.5 text-xs font-medium text-neutral-500">
                      {planOptionsLabel(section.total_count)}
                    </p>
                  </div>
                  {section.total_count > section.vendors.length ? (
                    <Link
                      href={planSeeMoreHref(pathname, state, section)}
                      className="text-sm font-semibold text-primary hover:underline"
                    >
                      See more
                    </Link>
                  ) : null}
                </div>
                {sectionCards.length === 0 ? (
                  <LottieEmptyPanel
                    variant="vendors"
                    title="No vendors for this yet"
                    description="Try another category or check back as we add more vendors."
                  />
                ) : (
                  <div className={CARD_GRID}>
                    {sectionCards.map((card, index) => (
                      <MotionStaggerItem
                        key={`${section.need_id}-${card.cardKey}`}
                        index={index}
                        className={CARD_GRID_ITEM}
                      >
                        <MarketplaceVendorCard
                          card={card}
                          vendorDetailHref={buildClientBrowseVendorUrl(card.vendor.user_id, state)}
                          bookmarked={isSaved(card.vendor.user_id)}
                          onToggleBookmark={() => toggle(card.vendor.user_id)}
                          onNavigate={onVendorNavigate}
                          showPlanEvidence
                          {...cardSelectProps(card.vendor)}
                        />
                      </MotionStaggerItem>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
          {selectionBar}
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {matchNotice ? (
            <p className="rounded-lg border border-primary-border/60 bg-primary-soft/40 px-4 py-3 text-sm text-neutral-800">
              {matchNotice}
            </p>
          ) : null}

          {exactCards.length > 0 ? (
            <div className={CARD_GRID}>
              {exactCards.map((card, index) => (
                <MotionStaggerItem key={card.cardKey} index={index} className={CARD_GRID_ITEM}>
                  <MarketplaceVendorCard
                    card={card}
                    vendorDetailHref={buildClientBrowseVendorUrl(card.vendor.user_id, state)}
                    bookmarked={isSaved(card.vendor.user_id)}
                    onToggleBookmark={() => toggle(card.vendor.user_id)}
                    onNavigate={onVendorNavigate}
                    {...cardSelectProps(card.vendor)}
                  />
                </MotionStaggerItem>
              ))}
            </div>
          ) : null}

          {alsoConsiderCards.length > 0 ? (
            <div>
              <div className="mb-4 border-t border-neutral-200 pt-6">
                <p className="text-sm font-semibold text-neutral-900">Also consider</p>
              </div>
              <div className={CARD_GRID}>
                {alsoConsiderCards.map((card, index) => (
                  <MotionStaggerItem key={card.cardKey} index={index} className={CARD_GRID_ITEM}>
                    <MarketplaceVendorCard
                      card={card}
                      vendorDetailHref={buildClientBrowseVendorUrl(card.vendor.user_id, state)}
                      bookmarked={isSaved(card.vendor.user_id)}
                      onToggleBookmark={() => toggle(card.vendor.user_id)}
                      onNavigate={onVendorNavigate}
                      {...cardSelectProps(card.vendor)}
                    />
                  </MotionStaggerItem>
                ))}
              </div>
            </div>
          ) : null}

          {pagination}
          {selectionBar}
        </div>
      )}

      {multiEnquireOpen && selectedCount > 0 ? (
        <MultiVendorEnquireModal
          vendors={selectedVendors}
          clientSearchContext={multiEnquireContext}
          enquirySource={state.fromPlannerPlanId ? "planner" : "multi"}
          searchPrefill={searchPrefill}
          initialPrefill={planEventPrefill}
          linkedEventId={state.linkedEventId}
          onClose={() => setMultiEnquireOpen(false)}
          onSuccess={(createdIds) => {
            setMultiEnquireOpen(false);
            clearSelection();
            showToast({
              title:
                createdIds.length === 1
                  ? CLIENT_BOOKING_TOAST_COPY.requestSent
                  : CLIENT_BOOKING_TOAST_COPY.requestsSent(createdIds.length),
              tone: "success",
            });
            router.push(
              createdIds.length === 1
                ? `/client/bookings/${createdIds[0]}`
                : "/client/bookings",
            );
          }}
        />
      ) : null}
      {launchingSoonModal}
    </div>
  );

  if (embedded) {
    return (
      <>
        <div className="mt-5">{filtersAndResults}</div>
        <ScrollToTopButton />
      </>
    );
  }

  return (
    <MarketplaceBrowseShell>
      {!savedOnly ? (
        <div className="mb-6">
          <h1 className="font-heading text-2xl font-semibold text-neutral-900 sm:text-3xl">
            Find vendors
          </h1>
        </div>
      ) : null}
      {filtersAndResults}
      <ScrollToTopButton />
    </MarketplaceBrowseShell>
  );
}
