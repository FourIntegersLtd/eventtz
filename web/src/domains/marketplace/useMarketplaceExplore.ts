"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchExploreVendorsSearch,
  type ExploreSearchPlan,
  type ExploreSearchSection,
  type ExploreVendorSearchRow,
} from "./api";
import {
  buildMarketplaceSearchUrl,
  marketplaceStateFromSearchParams,
  marketplaceStateToExploreQuery,
  MARKETPLACE_PAGE_SIZE,
  type MarketplaceSearchState,
} from "./marketplaceSearchParams";
import {
  buildMarketplaceResultsHeadline,
  expandVendorsForSearchResults,
} from "./marketplaceSearchModel";
import { useMarketplaceBookmarks } from "./useMarketplaceBookmarks";

/**
 * URL-driven marketplace explore hook. The URL is the single source of truth.
 * `loading` is derived from whether the latest result answers the current
 * filters, not toggled with its own setState in the effect body.
 */
export function useMarketplaceExplore(mode: "browse" | "favorites" = "browse") {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const state = useMemo(() => marketplaceStateFromSearchParams(searchParams), [searchParams]);
  const fetchKey = searchParams.toString();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vendorList, setVendorList] = useState<ExploreVendorSearchRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [matchNotice, setMatchNotice] = useState<string | null>(null);
  const [searchMode, setSearchMode] = useState<"simple" | "plan">("simple");
  const [plan, setPlan] = useState<ExploreSearchPlan | null>(null);
  const [sections, setSections] = useState<ExploreSearchSection[]>([]);

  const bookmarks = useMarketplaceBookmarks();
  const { isSaved, toggle, savedIds, ready: bookmarksReady, error: bookmarkError } = bookmarks;
  const savedOnly = mode === "favorites";

  const favoriteVendorIds = useMemo(
    () => (savedOnly && savedIds.size > 0 ? [...savedIds] : undefined),
    [savedOnly, savedIds],
  );

  const effectiveVendorIds = useMemo(() => {
    if (favoriteVendorIds) return favoriteVendorIds;
    return state.vendorIds.length > 0 ? state.vendorIds : undefined;
  }, [favoriteVendorIds, state.vendorIds]);

  useEffect(() => {
    if (savedOnly && !bookmarksReady) return;

    let cancelled = false;
    const queryState = marketplaceStateToExploreQuery(state, {
      vendorIds: effectiveVendorIds,
      limit: MARKETPLACE_PAGE_SIZE,
      offset: Math.max(0, (state.page - 1) * MARKETPLACE_PAGE_SIZE),
    });

    fetchExploreVendorsSearch(queryState)
      .then((result) => {
        if (cancelled) return;
        setVendorList(result.vendors ?? []);
        setTotalCount(result.total_count ?? 0);
        setMatchNotice(result.match_notice ?? null);
        setSearchMode(result.search_mode === "plan" ? "plan" : "simple");
        setPlan(result.plan ?? null);
        setSections(result.sections ?? []);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setVendorList([]);
        setTotalCount(0);
        setError(cause instanceof Error ? cause.message : "Could not load vendors");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fetchKey, savedOnly, bookmarksReady, savedIds, state, effectiveVendorIds]);

  const isPlanMode = searchMode === "plan";
  const headline = useMemo(
    () => buildMarketplaceResultsHeadline(state),
    [state],
  );

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

  const commitFilters = useCallback(
    (next: MarketplaceSearchState) => {
      commit(next);
    },
    [commit],
  );

  const onVendorNavigate = useCallback((_vendorUserId: string) => {
    // Reserved for analytics wiring.
  }, []);

  const goToPage = useCallback(
    (page: number) => {
      commit({ ...state, page });
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    [commit, state],
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
    commitFilters,
    onVendorNavigate,
    goToPage,
    headline,
    isPlanMode,
    visibleCards,
    displayCount,
    exactCards,
    alsoConsiderCards,
  };
}
