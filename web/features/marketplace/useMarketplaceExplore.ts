"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  fetchExploreVendorsSearch,
  type ExploreSearchPlan,
  type ExploreSearchSection,
  type ExploreVendorSearchRow,
} from "@/lib/clientExploreApi";
import {
  buildMarketplaceSearchUrl,
  clientSearchContextFromBrowse,
  marketplaceSearchPrefillFromState,
  marketplaceStateFromSearchParams,
  marketplaceStateToExploreQuery,
  MARKETPLACE_PAGE_SIZE,
  type MarketplaceSearchState,
} from "@/lib/marketplaceSearchParams";
import type { EventEnquirePrefill } from "@/features/bookings/eventEnquirePrefill";
import { eventEnquirePrefillFromSearchParams } from "@/features/bookings/eventEnquirePrefill";
import {
  buildMarketplaceResultsHeadline,
  expandVendorsForSearchResults,
} from "@/features/marketplace/marketplaceSearchModel";
import { useMarketplaceBookmarks } from "@/features/marketplace/useMarketplaceBookmarks";
import { useLaunchingSoonBookingGuard } from "@/features/bookings/useLaunchingSoonBookingGuard";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";

export function useMarketplaceExplore(mode: "browse" | "favorites" = "browse") {
  const sp = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();

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
  const [selectedById, setSelectedById] = useState<Record<string, ExploreVendorSearchRow>>({});
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
        const result = await fetchExploreVendorsSearch(
          marketplaceStateToExploreQuery(state, {
            vendorIds: savedOnly ? favoriteVendorIds : searchVendorIds,
            limit: MARKETPLACE_PAGE_SIZE,
            offset: (page - 1) * MARKETPLACE_PAGE_SIZE,
          }),
        );
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
  }, [state.fromPlannerPlanId, state.vendorIds, loading, vendors, sections]);

  const expanded = useMemo(
    () => expandVendorsForSearchResults(vendors, state.types),
    [vendors, state.types],
  );

  const headline =
    searchMode === "plan" && plan?.title
      ? plan.title
      : buildMarketplaceResultsHeadline(state);

  const isPlanMode = searchMode === "plan" && sections.length > 0 && !savedOnly;

  const searchPrefill = useMemo(
    () => marketplaceSearchPrefillFromState(state),
    [state],
  );

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

  const multiEnquireContext = useMemo(
    () => clientSearchContextFromBrowse(state),
    [state],
  );

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

  return {
    pathname,
    router,
    state,
    fetchKey,
    loading,
    error,
    vendors,
    totalCount,
    matchNotice,
    searchMode,
    plan,
    sections,
    selectedById,
    selectedVendors,
    selectedCount,
    toggleSelect,
    clearSelection,
    multiEnquireOpen,
    setMultiEnquireOpen,
    isSaved,
    toggle,
    savedOnly,
    isClient,
    searchPrefill,
    planEventPrefill,
    multiEnquireContext,
    commit,
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
    guardBooking,
    launchingSoonModal,
  };
}
