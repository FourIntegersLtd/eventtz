"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import {
  fetchExploreVendorsSearch,
  type ExploreSearchPlan,
  type ExploreSearchSection,
  type ExploreVendorSearchRow,
} from "@/lib/clientExploreApi";
import {
  buildClientBrowseVendorUrl,
  buildMarketplaceSearchUrl,
  marketplaceStateFromSearchParams,
  MARKETPLACE_PAGE_SIZE,
  toClientSearchContext,
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
import { MarketplaceVendorCard } from "@/features/marketplace/MarketplaceVendorCard";
import { MotionStaggerItem } from "@/components/ui/MotionStaggerItem";
import { MultiVendorEnquireModal } from "@/features/marketplace/MultiVendorEnquireModal";
import type { EventEnquirePrefill } from "@/features/bookings/eventEnquirePrefill";
import { eventEnquirePrefillFromSearchParams } from "@/features/bookings/eventEnquirePrefill";
import {
  buildMarketplaceResultsHeadline,
  expandVendorsForSearchResults,
} from "@/features/marketplace/marketplaceSearchModel";
import {
  planOptionsLabel,
} from "@/features/marketplace/marketplacePlanCopy";
import { useMarketplaceBookmarks } from "@/features/marketplace/useMarketplaceBookmarks";
import { ScrollToTopButton } from "@/components/ui/ScrollToTopButton";
import { useLaunchingSoonBookingGuard } from "@/features/bookings/useLaunchingSoonBookingGuard";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";

const CARD_GRID =
  "grid justify-items-center gap-6 sm:grid-cols-2 sm:gap-7 lg:grid-cols-3 lg:gap-8";

function planSeeMoreHref(
  pathname: string,
  state: MarketplaceSearchState,
  section: ExploreSearchSection,
): string {
  // Types-only: keep simple mode. Do not reuse the plan query or section label
  // (e.g. "Birthday cake") or the AI may re-enter plan mode.
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
  const sp = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();

  const state = useMemo(() => marketplaceStateFromSearchParams(sp), [sp]);
  const fetchKey = sp.toString();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vendors, setVendors] = useState<ExploreVendorSearchRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [matchNotice, setMatchNotice] = useState<string | null>(null);
  const [searchMode, setSearchMode] = useState<"simple" | "plan">("simple");
  const [plan, setPlan] = useState<ExploreSearchPlan | null>(null);
  const [sections, setSections] = useState<ExploreSearchSection[]>([]);
  const [selectedById, setSelectedById] = useState<Record<string, ExploreVendorSearchRow>>(
    {},
  );
  const [multiEnquireOpen, setMultiEnquireOpen] = useState(false);
  const plannerAutoSelectDone = useRef(false);

  const { isSaved, toggle, savedIds, ready: bookmarksReady } = useMarketplaceBookmarks();
  const { guardBooking, launchingSoonModal } = useLaunchingSoonBookingGuard();
  const savedOnly = mode === "favorites";
  const favoriteVendorIds = useMemo(
    () => (savedOnly && savedIds.size > 0 ? [...savedIds] : undefined),
    [savedOnly, savedIds],
  );
  const searchVendorIds = useMemo(
    () => (state.vendorIds.length > 0 ? state.vendorIds : undefined),
    [state.vendorIds],
  );

  const isClient = user?.user_type === "client";
  const selectedVendors = useMemo(() => Object.values(selectedById), [selectedById]);
  const selectedCount = selectedVendors.length;

  const toggleSelect = useCallback((vendor: ExploreVendorSearchRow) => {
    setSelectedById((prev) => {
      const next = { ...prev };
      if (next[vendor.user_id]) {
        delete next[vendor.user_id];
      } else {
        next[vendor.user_id] = vendor;
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedById({}), []);

  useEffect(() => {
    if (savedOnly && !bookmarksReady) return;
    if (savedOnly && bookmarksReady && savedIds.size === 0) {
      setVendors([]);
      setTotalCount(0);
      setMatchNotice(null);
      setSearchMode("simple");
      setPlan(null);
      setSections([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const page = state.page;
        const result = await fetchExploreVendorsSearch({
            query: state.query || undefined,
            types: state.types.length ? state.types : undefined,
            location: state.location || undefined,
            country: state.country,
            dates: state.dates,
            flexible: state.dateFlexible,
            budgetMin: state.budgetMin,
            budgetMax: state.budgetMax,
            sort: state.sort,
            vendorIds: savedOnly ? favoriteVendorIds : searchVendorIds,
            limit: MARKETPLACE_PAGE_SIZE,
            offset: (page - 1) * MARKETPLACE_PAGE_SIZE,
          });
        if (!cancelled) {
          setVendors(result.vendors);
          setTotalCount(result.totalCount);
          setMatchNotice(result.matchNotice);
          setSearchMode(result.searchMode);
          setPlan(result.plan);
          setSections(result.sections);
          track(MixpanelEvents.marketplace_results_viewed, {
            result_count: result.totalCount,
            page: state.page,
            saved_only: savedOnly,
            search_mode: result.searchMode,
          });
        }
      } catch {
        if (!cancelled) setError("Could not load vendors right now.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchKey, state, savedOnly, bookmarksReady, favoriteVendorIds, searchVendorIds, savedIds.size]);

  useEffect(() => {
    plannerAutoSelectDone.current = false;
  }, [fetchKey]);

  useEffect(() => {
    if (
      plannerAutoSelectDone.current ||
      !state.fromPlannerPlanId ||
      state.vendorIds.length === 0 ||
      loading
    ) {
      return;
    }
    const idSet = new Set(state.vendorIds);
    const rows: ExploreVendorSearchRow[] = [...vendors];
    for (const section of sections) {
      rows.push(...section.vendors);
    }
    const matches = rows.filter((v) => idSet.has(v.user_id));
    if (matches.length === 0) return;
    setSelectedById((prev) => {
      const next = { ...prev };
      for (const v of matches) {
        next[v.user_id] = v;
      }
      return next;
    });
    plannerAutoSelectDone.current = true;
  }, [
    state.fromPlannerPlanId,
    state.vendorIds,
    loading,
    vendors,
    sections,
  ]);

  const expanded = useMemo(
    () => expandVendorsForSearchResults(vendors, state.types),
    [vendors, state.types],
  );

  const headline =
    searchMode === "plan" && plan?.title
      ? plan.title
      : buildMarketplaceResultsHeadline(state);

  const isPlanMode = searchMode === "plan" && sections.length > 0 && !savedOnly;

  const searchPrefill = useMemo(() => {
    const d = state.dates;
    const first = d[0];
    let eventEndDate: string | undefined;
    if (d.length === 2 && first && d[1] && d[1] >= first) {
      eventEndDate = d[1];
    }
    return {
      eventDate: first ?? "",
      eventEndDate,
      datesFlexible: state.dateFlexible,
    };
  }, [state.dates, state.dateFlexible]);

  const planEventPrefill = useMemo((): EventEnquirePrefill | undefined => {
    if (state.eventName.trim() || state.venue.trim() || state.planNotes.trim()) {
      return {
        eventName: state.eventName,
        eventDate: searchPrefill.eventDate || "",
        eventEndDate: searchPrefill.eventEndDate || "",
        venueAddress: state.venue,
        notes: state.planNotes,
      };
    }
    const fromPlannerParams = eventEnquirePrefillFromSearchParams(sp);
    if (fromPlannerParams) return fromPlannerParams;
    if (searchMode !== "plan" || !plan?.title?.trim()) return undefined;
    return {
      eventName: plan.title.trim(),
      eventDate: searchPrefill.eventDate || "",
      eventEndDate: searchPrefill.eventEndDate || "",
      venueAddress: state.location.trim(),
      notes: "",
    };
  }, [
    state.eventName,
    state.venue,
    state.planNotes,
    sp,
    searchMode,
    plan?.title,
    searchPrefill,
    state.location,
  ]);

  const multiEnquireContext = useMemo(() => {
    const base = toClientSearchContext(state);
    if (state.fromPlannerPlanId) {
      return {
        ...base,
        source: "planner" as const,
        plannerPlanId: state.fromPlannerPlanId,
      };
    }
    return base;
  }, [state]);

  const commit = useCallback(
    (next: MarketplaceSearchState) => {
      router.replace(buildMarketplaceSearchUrl(pathname, next));
    },
    [pathname, router],
  );

  const commitFilters = useCallback(
    (next: MarketplaceSearchState) => {
      track(MixpanelEvents.marketplace_filters_applied, {
        has_budget: next.budgetMin != null || next.budgetMax != null,
        sort: next.sort,
      });
      commit(next);
    },
    [commit],
  );

  const onVendorNavigate = useCallback((vendorUserId: string) => {
    track(MixpanelEvents.marketplace_vendor_clicked, {
      vendor_user_id: vendorUserId,
    });
  }, []);

  const openMultiEnquire = useCallback(() => {
    guardBooking(() => {
      track(MixpanelEvents.multi_enquire_opened, {
        vendor_count: selectedCount,
      });
      setMultiEnquireOpen(true);
    });
  }, [guardBooking, selectedCount]);

  const goToPage = useCallback(
    (page: number) => {
      commit({ ...state, page });
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    [commit, state],
  );

  const visibleCards = expanded;
  const displayCount = totalCount;

  const exactCards = useMemo(
    () =>
      visibleCards.filter(
        (card) => !card.vendor.match_tier || card.vendor.match_tier === "exact",
      ),
    [visibleCards],
  );
  const alsoConsiderCards = useMemo(
    () =>
      visibleCards.filter(
        (card) =>
          card.vendor.match_tier === "related" || card.vendor.match_tier === "fallback",
      ),
    [visibleCards],
  );

  const cardSelectProps = (vendor: ExploreVendorSearchRow) =>
    isClient
      ? {
          selectable: true as const,
          selected: Boolean(selectedById[vendor.user_id]),
          onToggleSelect: () => toggleSelect(vendor),
        }
      : {};

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
    isClient && selectedCount > 0 ? (
      <div className="sticky bottom-4 z-30 mx-auto mt-6 flex max-w-xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-white px-4 py-3 shadow-lg ring-1 ring-primary/10">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-900">
            {selectedCount} selected
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={clearSelection}>
            Clear
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={openMultiEnquire}
            disabled={selectedCount < 1}
          >
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
      />

      {state.fromPlannerPlanId && !loading ? (
        <div className="mt-4 rounded-xl border border-primary/15 bg-[#faf8fc] px-4 py-3 text-sm text-neutral-800">
          From your celebration plan - open a vendor to pick packages, or select several and
          message them together.
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
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
                  {need.optional ? (
                    <span className="text-neutral-400">optional</span>
                  ) : null}
                </a>
              ))}
            </div>
          ) : null}
        </div>
        <MarketplaceFiltersBar state={state} onCommit={commitFilters} />
      </div>

      {loading ? (
        <LoadingState label="Loading vendors…" variant="centered" className="mt-6 py-12" branded />
      ) : error ? (
        <LottieFailureInline message={error} className="mt-6" />
      ) : visibleCards.length === 0 && !isPlanMode ? (
        <LottieEmptyPanel
          className="mt-6"
          lottie={savedOnly ? "emptyInbox" : "searchNoResults"}
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
              <MotionStaggerItem key={card.cardKey} index={index}>
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
                        <span className="ml-2 text-sm font-medium text-neutral-500">
                          Optional
                        </span>
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
                    lottie="emptyInbox"
                    title="No vendors for this yet"
                    description="Try another category or check back as we add more vendors."
                  />
                ) : (
                  <div className={CARD_GRID}>
                    {sectionCards.map((card, index) => (
                      <MotionStaggerItem key={`${section.need_id}-${card.cardKey}`} index={index}>
                        <MarketplaceVendorCard
                          card={card}
                          vendorDetailHref={buildClientBrowseVendorUrl(
                            card.vendor.user_id,
                            state,
                          )}
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
                <MotionStaggerItem key={card.cardKey} index={index}>
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
                  <MotionStaggerItem key={card.cardKey} index={index}>
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
                  ? "Request sent"
                  : `${createdIds.length} requests sent`,
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
