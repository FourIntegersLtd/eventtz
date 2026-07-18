"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { EventtzLogo } from "@/components/branding/EventtzLogo";
import { PortalShell } from "@/components/portal-shell/PortalShell";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { getButtonClassName } from "@/components/ui/buttonStyles";
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
import { MarketplaceFiltersBar } from "@/features/marketplace/MarketplaceFiltersBar";
import { MarketplacePagination } from "@/features/marketplace/MarketplacePagination";
import { LoadingState } from "@/components/ui/LoadingState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { MarketplaceVendorCard } from "@/features/marketplace/MarketplaceVendorCard";
import { MultiVendorEnquireModal } from "@/features/marketplace/MultiVendorEnquireModal";
import {
  buildMarketplaceResultsHeadline,
  expandVendorsForSearchResults,
} from "@/features/marketplace/marketplaceSearchModel";
import {
  planOptionsLabel,
} from "@/features/marketplace/marketplacePlanCopy";
import { useMarketplaceBookmarks } from "@/features/marketplace/useMarketplaceBookmarks";
import { ScrollToTopButton } from "@/components/ui/ScrollToTopButton";
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

  const { isSaved, toggle, savedIds, ready: bookmarksReady } = useMarketplaceBookmarks();
  const savedOnly = mode === "favorites";
  const favoriteVendorIds = useMemo(
    () => (savedOnly && savedIds.size > 0 ? [...savedIds] : undefined),
    [savedOnly, savedIds],
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
            vendorIds: favoriteVendorIds,
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
  }, [fetchKey, state, savedOnly, bookmarksReady, favoriteVendorIds, savedIds.size]);

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
    track(MixpanelEvents.multi_enquire_opened, {
      vendor_count: selectedCount,
    });
    setMultiEnquireOpen(true);
  }, [selectedCount]);

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
        <LoadingState label="Loading vendors…" variant="centered" className="mt-6 py-12" />
      ) : error ? (
        <p className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : visibleCards.length === 0 && !isPlanMode ? (
        <p className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
          {savedOnly ? "No saved vendors yet." : "No vendors match these filters."}
        </p>
      ) : savedOnly ? (
        <>
          <div className={`mt-6 ${CARD_GRID}`}>
            {visibleCards.map((card) => (
              <MarketplaceVendorCard
                key={card.cardKey}
                card={card}
                vendorDetailHref={buildClientBrowseVendorUrl(card.vendor.user_id, state)}
                bookmarked={isSaved(card.vendor.user_id)}
                onToggleBookmark={() => toggle(card.vendor.user_id)}
                onNavigate={onVendorNavigate}
                {...cardSelectProps(card.vendor)}
              />
            ))}
          </div>
          {pagination}
          {selectionBar}
        </>
      ) : isPlanMode ? (
        <div className="mt-6 space-y-10">
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
                  <p className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                    No vendors for this yet.
                  </p>
                ) : (
                  <div className={CARD_GRID}>
                    {sectionCards.map((card) => (
                      <MarketplaceVendorCard
                        key={`${section.need_id}-${card.cardKey}`}
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
              {exactCards.map((card) => (
                <MarketplaceVendorCard
                  key={card.cardKey}
                  card={card}
                  vendorDetailHref={buildClientBrowseVendorUrl(card.vendor.user_id, state)}
                  bookmarked={isSaved(card.vendor.user_id)}
                  onToggleBookmark={() => toggle(card.vendor.user_id)}
                  onNavigate={onVendorNavigate}
                  {...cardSelectProps(card.vendor)}
                />
              ))}
            </div>
          ) : null}

          {alsoConsiderCards.length > 0 ? (
            <div>
              <div className="mb-4 border-t border-neutral-200 pt-6">
                <p className="text-sm font-semibold text-neutral-900">Also consider</p>
              </div>
              <div className={CARD_GRID}>
                {alsoConsiderCards.map((card) => (
                  <MarketplaceVendorCard
                    key={card.cardKey}
                    card={card}
                    vendorDetailHref={buildClientBrowseVendorUrl(card.vendor.user_id, state)}
                    bookmarked={isSaved(card.vendor.user_id)}
                    onToggleBookmark={() => toggle(card.vendor.user_id)}
                    onNavigate={onVendorNavigate}
                    {...cardSelectProps(card.vendor)}
                  />
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
          clientSearchContext={toClientSearchContext(state)}
          searchPrefill={searchPrefill}
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
    </div>
  );

  if (user && embedded) {
    return (
      <>
        <div className="mt-5">{filtersAndResults}</div>
        <ScrollToTopButton />
      </>
    );
  }

  if (user && !embedded) {
    return (
      <PortalShell portal="client" title={savedOnly ? "Favorites" : "Browse vendors"}>
        <div className="mt-5">{filtersAndResults}</div>
        <ScrollToTopButton />
      </PortalShell>
    );
  }

  return (
    <div className="min-h-dvh bg-page-bg text-neutral-900">
      <header className="bg-primary-soft/95 backdrop-blur-xl">
        <div className="mx-auto flex min-w-0 max-w-8xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-12">
          <EventtzLogo
            href="/"
            className="inline-flex min-w-0 shrink-0 items-center"
            variant="header"
            imageClassName="h-9 w-auto sm:h-10"
            width={200}
            height={72}
          />
          <nav className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 text-sm sm:flex-none">
            <Link
              href="/login"
              className={getButtonClassName({
                variant: "ghost",
                shape: "pill",
                className: "px-3 py-1.5",
              })}
            >
              Sign in
            </Link>
            <ButtonLink href="/register?type=client" shape="pill" className="px-4 py-2">
              Create account
            </ButtonLink>
          </nav>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="font-heading text-2xl font-semibold text-neutral-900 sm:text-3xl">
            Find vendors
          </h1>
        </div>
        {filtersAndResults}
        <ScrollToTopButton />
      </div>
    </div>
  );
}
