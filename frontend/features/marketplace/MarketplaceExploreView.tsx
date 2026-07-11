"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { EventtzLogo } from "@/components/branding/EventtzLogo";
import { PortalShell } from "@/components/portal-shell/PortalShell";
import {
  fetchExploreVendorsSearch,
  type ExploreVendorSearchRow,
} from "@/lib/clientExploreApi";
import {
  buildClientBrowseVendorUrl,
  buildMarketplaceSearchUrl,
  marketplaceStateFromSearchParams,
  type MarketplaceSearchState,
} from "@/lib/marketplaceSearchParams";
import { HeroMarketplaceSearch } from "@/features/marketplace/HeroMarketplaceSearch";
import { MarketplaceFiltersBar } from "@/features/marketplace/MarketplaceFiltersBar";
import { MarketplaceCategoryChips } from "@/features/marketplace/MarketplaceCategoryChips";
import { MarketplaceVendorCard } from "@/features/marketplace/MarketplaceVendorCard";
import {
  buildMarketplaceResultsHeadline,
  expandVendorsForSearchResults,
} from "@/features/marketplace/marketplaceSearchModel";
import { useMarketplaceBookmarks } from "@/features/marketplace/useMarketplaceBookmarks";
import { ScrollToTopButton } from "@/components/ui/ScrollToTopButton";

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

  const state = useMemo(() => marketplaceStateFromSearchParams(sp), [sp]);
  const fetchKey = sp.toString();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vendors, setVendors] = useState<ExploreVendorSearchRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const { vendors: rows } = await fetchExploreVendorsSearch({
          query: state.query || undefined,
          types: state.types.length ? state.types : undefined,
          location: state.location || undefined,
          dates: state.dates,
          flexible: state.dateFlexible,
          budgetMin: state.budgetMin,
          budgetMax: state.budgetMax,
          sort: state.sort,
        });
        if (!cancelled) setVendors(rows);
      } catch {
        if (!cancelled) setError("Could not load vendors right now.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchKey, state]);

  const expanded = useMemo(
    () => expandVendorsForSearchResults(vendors, state.types),
    [vendors, state.types],
  );

  const headline = buildMarketplaceResultsHeadline(state);

  const commit = useCallback(
    (next: MarketplaceSearchState) => {
      router.replace(buildMarketplaceSearchUrl(pathname, next));
    },
    [pathname, router],
  );

  const toggleCategory = useCallback(
    (value: string) => {
      const types = state.types.includes(value)
        ? state.types.filter((t) => t !== value)
        : [...state.types, value];
      commit({ ...state, types });
    },
    [state, commit],
  );

  const { isSaved, toggle, savedIds } = useMarketplaceBookmarks();

  const savedOnly = mode === "favorites";
  const visibleCards = savedOnly
    ? expanded.filter((card) => savedIds.has(card.vendor.user_id))
    : expanded;
  const displayCount = visibleCards.length;

  const filtersAndResults = (
    <div className="w-full min-w-0">
      {!savedOnly ? (
        <MarketplaceCategoryChips selectedTypes={state.types} onToggle={toggleCategory} />
      ) : null}

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
            {loading ? "…" : `${displayCount} result${displayCount === 1 ? "" : "s"}`}
          </p>
          {!savedOnly && headline ? (
            <p className="mt-1 text-sm text-neutral-600">{headline}</p>
          ) : null}
        </div>
        <MarketplaceFiltersBar state={state} onCommit={commit} />
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-neutral-600">Loading vendors…</p>
      ) : error ? (
        <p className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : visibleCards.length === 0 ? (
        <p className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
          {savedOnly
            ? "No saved vendors yet — tap the heart on any vendor card while browsing to add them here."
            : "No vendors match these filters yet. Try clearing types, widening your budget"}
          {!savedOnly && state.dates.length > 0 && !state.dateFlexible
            ? ", or choosing different dates — some vendors may be unavailable on the days you selected."
            : savedOnly ? "" : ", or adjusting your search."}
        </p>
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
      )}
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
    <div className="min-h-screen bg-page-bg text-slate-800">
      <header className="bg-violet-50/95 backdrop-blur-xl">
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
              className="rounded-full px-3 py-1.5 font-medium text-slate-700 transition hover:bg-white/80"
            >
              Sign in
            </Link>
            <Link
              href="/register?type=client"
              className="rounded-full bg-primary px-4 py-2 font-semibold text-white transition hover:opacity-95"
            >
              Create account
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="font-heading text-2xl font-semibold text-neutral-900 sm:text-3xl">
            Find vendors
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-neutral-600 sm:text-base">
            Search by category, location, and dates. Save favourites locally until
            accounts support synced lists.
          </p>
        </div>
        {filtersAndResults}
        <ScrollToTopButton />
      </div>
    </div>
  );
}
