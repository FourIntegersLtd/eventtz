"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "@/foundation/session";
import {
  fetchExploreVendorsSearch,
  type ExploreSearchPlan,
  type ExploreSearchSection,
  type ExploreVendorSearchRow,
} from "./api";
import {
  buildMarketplaceSearchUrl,
  clientSearchContextFromBrowse,
  eventEnquirePrefillFromMarketplaceState,
  marketplaceSearchPrefillFromState,
  marketplaceStateFromSearchParams,
  marketplaceStateToExploreQuery,
  MARKETPLACE_PAGE_SIZE,
  type MarketplaceSearchState,
} from "./marketplaceSearchParams";
import {
  clearSelectedVendors,
  listSelectedVendors,
  plannerPreselection,
  toggleSelectedVendor,
} from "./marketplaceSelection";
import {
  buildMarketplaceResultsHeadline,
  expandVendorsForSearchResults,
} from "./marketplaceSearchModel";
import { resolveMarketplaceExploreFetch } from "./marketplaceExploreFetchDecision";
import { useMarketplaceBookmarks } from "./useMarketplaceBookmarks";

const SEARCH_LOAD_ERROR = "Could not load vendors right now.";

type ExploreFetchResult = {
  key: string;
  vendors: ExploreVendorSearchRow[];
  totalCount: number;
  matchNotice: string | null;
  searchMode: "simple" | "plan";
  plan: ExploreSearchPlan | null;
  sections: ExploreSearchSection[];
  error: string | null;
};

function emptyExploreResult(key: string): ExploreFetchResult {
  return {
    key,
    vendors: [],
    totalCount: 0,
    matchNotice: null,
    searchMode: "simple",
    plan: null,
    sections: [],
    error: null,
  };
}

/**
 * URL-driven marketplace explore hook. The URL is the single source of truth.
 * Loading is derived: stale results stay hidden until the in-flight key matches.
 */
export function useMarketplaceExplore(mode: "browse" | "favorites" = "browse") {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { session } = useSession();
  const isClient = session?.user.user_type === "client";
  const [selectedById, setSelectedById] = useState<Record<string, ExploreVendorSearchRow>>({});
  const [multiEnquireOpen, setMultiEnquireOpen] = useState(false);

  const state = useMemo(() => marketplaceStateFromSearchParams(searchParams), [searchParams]);
  const fetchKey = searchParams.toString();

  const [fetchResult, setFetchResult] = useState<ExploreFetchResult | null>(null);

  const bookmarks = useMarketplaceBookmarks();
  const { isSaved, toggle, savedIds, ready: bookmarksReady, error: bookmarkError } = bookmarks;
  const savedOnly = mode === "favorites";

  const fetchDecision = useMemo(
    () =>
      resolveMarketplaceExploreFetch({
        savedOnly,
        bookmarksReady,
        savedVendorIds: savedIds,
        urlVendorIds: state.vendorIds,
      }),
    [savedOnly, bookmarksReady, savedIds, state.vendorIds],
  );

  const currentKey = useMemo(() => {
    const vendorKey = fetchDecision.shouldFetch
      ? fetchDecision.vendorIds?.join(",") ?? ""
      : "none";
    return `${fetchKey}|${savedOnly}|${bookmarksReady}|${vendorKey}`;
  }, [fetchKey, savedOnly, bookmarksReady, fetchDecision]);

  const waitingForBookmarks = savedOnly && !bookmarksReady;
  const skipFetchResult = useMemo(() => {
    if (fetchDecision.shouldFetch || waitingForBookmarks) return null;
    return emptyExploreResult(currentKey);
  }, [fetchDecision.shouldFetch, waitingForBookmarks, currentKey]);

  useEffect(() => {
    if (!fetchDecision.shouldFetch) return;

    let cancelled = false;
    const queryState = marketplaceStateToExploreQuery(state, {
      vendorIds: fetchDecision.vendorIds,
      limit: MARKETPLACE_PAGE_SIZE,
      offset: Math.max(0, (state.page - 1) * MARKETPLACE_PAGE_SIZE),
    });

    fetchExploreVendorsSearch(queryState)
      .then((response) => {
        if (cancelled) return;
        const vendors = response.vendors ?? [];
        const sections = response.sections ?? [];
        setFetchResult({
          key: currentKey,
          vendors,
          totalCount: response.total_count ?? 0,
          matchNotice: response.match_notice ?? null,
          searchMode: response.search_mode === "plan" ? "plan" : "simple",
          plan: response.plan ?? null,
          sections,
          error: null,
        });
        // Once per fetch, when these results arrive. A later deselect is left alone
        // because nothing here re-runs until the URL (and so this fetch) changes.
        const openedFromPlanner = Boolean(state.fromPlannerPlanId) && state.vendorIds.length > 0;
        if (isClient && mode === "browse" && openedFromPlanner) {
          const preselected = plannerPreselection(state.vendorIds, vendors, sections);
          if (Object.keys(preselected).length > 0) {
            setSelectedById((previous) => ({ ...previous, ...preselected }));
          }
        }
      })
      .catch(() => {
        if (cancelled) return;
        setFetchResult({
          ...emptyExploreResult(currentKey),
          error: SEARCH_LOAD_ERROR,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [currentKey, fetchDecision, isClient, mode, state]);

  const settledResult = useMemo(
    () => skipFetchResult ?? (fetchResult?.key === currentKey ? fetchResult : null),
    [skipFetchResult, fetchResult, currentKey],
  );

  const loading =
    waitingForBookmarks ||
    (fetchDecision.shouldFetch && fetchResult?.key !== currentKey);

  const vendorList = useMemo(
    () => settledResult?.vendors ?? [],
    [settledResult],
  );
  const totalCount = settledResult?.totalCount ?? 0;
  const matchNotice = settledResult?.matchNotice ?? null;
  const searchMode = settledResult?.searchMode ?? "simple";
  const plan = settledResult?.plan ?? null;
  const sections = settledResult?.sections ?? [];
  const error = settledResult?.error ?? null;

  const isPlanMode =
    searchMode === "plan" && sections.length > 0 && !savedOnly;

  const headline = useMemo(() => {
    if (searchMode === "plan" && plan?.title) return plan.title;
    return buildMarketplaceResultsHeadline(state);
  }, [searchMode, plan?.title, state]);

  const expanded = useMemo(
    () => expandVendorsForSearchResults(vendorList, state.types),
    [vendorList, state.types],
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

  const commit = useCallback(
    (next: MarketplaceSearchState) => {
      router.replace(buildMarketplaceSearchUrl(pathname, next));
    },
    [pathname, router],
  );

  const goToPage = useCallback(
    (page: number) => {
      commit({ ...state, page });
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    [commit, state],
  );

  const selectedVendors = useMemo(() => listSelectedVendors(selectedById), [selectedById]);
  const selectedCount = selectedVendors.length;

  const toggleSelect = useCallback((vendor: ExploreVendorSearchRow) => {
    setSelectedById((previous) => toggleSelectedVendor(previous, vendor));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedById(clearSelectedVendors());
  }, []);

  const searchPrefill = useMemo(() => marketplaceSearchPrefillFromState(state), [state]);

  const planEventPrefill = useMemo(() => {
    const fromPlanner = eventEnquirePrefillFromMarketplaceState(state);
    if (fromPlanner) return fromPlanner;
    if (searchMode !== "plan" || !plan?.title?.trim()) return null;
    return {
      eventName: plan.title.trim(),
      eventDate: searchPrefill.eventDate || "",
      eventEndDate: searchPrefill.eventEndDate || "",
      venueAddress: state.location.trim(),
      notes: "",
    };
  }, [state, searchMode, plan, searchPrefill]);

  const multiEnquireContext = useMemo(() => clientSearchContextFromBrowse(state), [state]);

  const openMultiEnquire = useCallback(() => {
    setMultiEnquireOpen(true);
  }, []);

  /** Select control props for a signed-in client. Guests get none. */
  const cardSelectProps = useCallback(
    (vendor: ExploreVendorSearchRow) =>
      isClient
        ? {
            selectable: true as const,
            selected: Boolean(selectedById[vendor.user_id]),
            onToggleSelect: () => toggleSelect(vendor),
          }
        : {},
    [isClient, selectedById, toggleSelect],
  );

  return {
    pathname,
    router,
    state,
    fetchKey,
    loading,
    error,
    vendors: vendorList,
    totalCount,
    matchNotice,
    searchMode,
    plan,
    sections,
    isSaved,
    toggle,
    savedOnly,
    bookmarkError,
    commit,
    goToPage,
    headline,
    isPlanMode,
    visibleCards,
    displayCount,
    exactCards,
    alsoConsiderCards,
    isClient,
    selectedVendors,
    selectedCount,
    clearSelection,
    multiEnquireOpen,
    setMultiEnquireOpen,
    searchPrefill,
    planEventPrefill,
    multiEnquireContext,
    openMultiEnquire,
    cardSelectProps,
  };
}
