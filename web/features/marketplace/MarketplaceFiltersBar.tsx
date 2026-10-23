"use client";

import { ArrowUpDown, ChevronDown, LocateFixed, SlidersHorizontal, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { FOCUS_RING } from "@/components/ui/tokens";
import {
  categoryChipLabel,
  MarketplaceCategoryFilterFields,
} from "@/features/marketplace/MarketplaceCategoryFilterFields";
import { LocationAutocompleteInput } from "@/components/ui/LocationAutocompleteInput";
import type { MarketplaceSort } from "@/lib/clientExploreApi";
import type { MarketplaceSearchState } from "@/lib/marketplaceSearchParams";
import {
  budgetFilterLabel,
  getMarket,
} from "@/lib/markets";
import { formatCurrencySymbol, formatMoney } from "@/lib/money";
import { marketplaceBudgetSchema, parseForm } from "@/lib/validation";

const FILTER_BUTTON_CLASS =
  "inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full border px-3 text-sm font-medium transition sm:gap-2 sm:px-4 lg:w-auto";

const SORT_OPTIONS: { value: MarketplaceSort; label: string }[] = [
  { value: "relevance", label: "Relevance" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "proximity", label: "Proximity" },
  { value: "rating", label: "Rating" },
];

function sortButtonLabel(sort: MarketplaceSort): string {
  if (sort === "price_asc") return "Price ↑";
  if (sort === "price_desc") return "Price ↓";
  return SORT_OPTIONS.find((o) => o.value === sort)?.label ?? "Sort";
}

type MarketplaceFiltersBarProps = {
  state: MarketplaceSearchState;
  onCommit: (next: MarketplaceSearchState) => void;
  onRequestCurrentLocation?: () => Promise<string | null>;
  geoLoading?: boolean;
  geoError?: string | null;
  onClearGeoError?: () => void;
};

function parseBudget(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number.parseFloat(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function activeFilterCount(state: MarketplaceSearchState): number {
  let count = 0;
  if (state.types.length > 0) count += 1;
  if (state.location.trim()) count += 1;
  if (state.budgetMin != null || state.budgetMax != null) count += 1;
  return count;
}

function sortLabel(sort: MarketplaceSort): string {
  return SORT_OPTIONS.find((o) => o.value === sort)?.label ?? "Sort";
}

/** Browse filters: one Filters drawer + anchored Sort menu (Airbnb-style). */
export function MarketplaceFiltersBar({
  state,
  onCommit,
  onRequestCurrentLocation,
  geoLoading = false,
  geoError = null,
  onClearGeoError,
}: MarketplaceFiltersBarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [draftTypes, setDraftTypes] = useState<string[]>(state.types);
  const [draftLocation, setDraftLocation] = useState(state.location);
  const [minStr, setMinStr] = useState(() =>
    state.budgetMin != null ? String(state.budgetMin) : "",
  );
  const [maxStr, setMaxStr] = useState(() =>
    state.budgetMax != null ? String(state.budgetMax) : "",
  );
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const [sortSheetMounted, setSortSheetMounted] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  const market = getMarket(state.country);
  const currencySymbol = formatCurrencySymbol(market.currency);
  const filterCount = activeFilterCount(state);

  const syncDraftFromState = useCallback((next: MarketplaceSearchState) => {
    setDraftTypes(next.types);
    setDraftLocation(next.location);
    setMinStr(next.budgetMin != null ? String(next.budgetMin) : "");
    setMaxStr(next.budgetMax != null ? String(next.budgetMax) : "");
    setBudgetError(null);
  }, []);

  useEffect(() => {
    if (filtersOpen) return;
    syncDraftFromState(state);
  }, [
    state.types,
    state.location,
    state.budgetMin,
    state.budgetMax,
    filtersOpen,
    syncDraftFromState,
    state,
  ]);

  useEffect(() => {
    setSortSheetMounted(true);
  }, []);

  useEffect(() => {
    if (!sortOpen) return;
    const isMobile = window.matchMedia("(max-width: 1023px)").matches;
    if (!isMobile) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [sortOpen]);

  useEffect(() => {
    if (!sortOpen) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target;
      if (!(target instanceof Node)) return;
      if (sortRef.current?.contains(target)) return;
      const sheet = document.getElementById("marketplace-sort-sheet");
      if (sheet?.contains(target)) return;
      setSortOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [sortOpen]);

  const openFilters = () => {
    setSortOpen(false);
    syncDraftFromState(state);
    onClearGeoError?.();
    setFiltersOpen(true);
  };

  const selectSort = (sort: MarketplaceSort) => {
    onCommit({ ...state, sort, page: 1 });
    setSortOpen(false);
  };

  const toggleSort = () => {
    setFiltersOpen(false);
    setSortOpen((open) => !open);
  };

  const sortActive = state.sort !== "relevance";
  const filterActiveClass = "border-primary/30 bg-primary/10 text-primary";
  const filterIdleClass = "border-line bg-white text-ink-2 hover:bg-surface-3";

  const sortOptionsList = (onSelect: (sort: MarketplaceSort) => void) =>
    SORT_OPTIONS.map((opt) => (
      <button
        key={opt.value}
        type="button"
        onClick={() => onSelect(opt.value)}
        className={`flex w-full rounded-lg px-3 py-3 text-left text-sm transition lg:py-2.5 ${
          state.sort === opt.value
            ? "bg-primary/10 font-medium text-primary"
            : "text-ink hover:bg-surface-3"
        }`}
      >
        {opt.label}
      </button>
    ));

  const buildClearedState = (): MarketplaceSearchState => ({
    ...state,
    types: [],
    location: "",
    budgetMin: null,
    budgetMax: null,
    sort: "relevance",
    page: 1,
  });

  const applyFilters = () => {
    const parsed = parseForm(marketplaceBudgetSchema, { min: minStr, max: maxStr });
    if (!parsed.ok) {
      setBudgetError(parsed.formError);
      return;
    }
    onCommit({
      ...state,
      types: draftTypes,
      location: draftLocation.trim(),
      budgetMin: parseBudget(minStr),
      budgetMax: parseBudget(maxStr),
      page: 1,
    });
    setFiltersOpen(false);
  };

  const clearAllFilters = () => {
    const cleared = buildClearedState();
    onClearGeoError?.();
    syncDraftFromState(cleared);
    setFiltersOpen(false);
    onCommit(cleared);
  };

  const handleUseCurrentLocation = async () => {
    if (!onRequestCurrentLocation) return;
    const label = await onRequestCurrentLocation();
    if (label) {
      setDraftLocation(label);
      setFiltersOpen(false);
    }
  };

  const removeType = (value: string) => {
    onCommit({
      ...state,
      types: state.types.filter((t) => t !== value),
      page: 1,
    });
  };

  const clearLocation = () => {
    onCommit({ ...state, location: "", page: 1 });
  };

  const clearBudget = () => {
    onCommit({ ...state, budgetMin: null, budgetMax: null, page: 1 });
  };

  const hasBudget = state.budgetMin != null || state.budgetMax != null;
  const budgetSummary = hasBudget
    ? `${state.budgetMin != null ? formatMoney(state.budgetMin, market.currency) : "any"}–${
        state.budgetMax != null ? formatMoney(state.budgetMax, market.currency) : "any"
      }`
    : null;

  return (
    <>
      <div className="mt-3 grid grid-cols-2 gap-2 lg:flex lg:justify-end lg:gap-2">
        <button
          type="button"
          onClick={openFilters}
          className={`${FILTER_BUTTON_CLASS} ${FOCUS_RING} ${
            filterCount > 0 ? filterActiveClass : filterIdleClass
          }`}
        >
          <SlidersHorizontal className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
          <span>Filters</span>
          {filterCount > 0 ? (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-white">
              {filterCount}
            </span>
          ) : null}
        </button>

        <div className="relative min-w-0 lg:w-auto" ref={sortRef}>
          <button
            type="button"
            aria-expanded={sortOpen}
            onClick={toggleSort}
            className={`${FILTER_BUTTON_CLASS} ${FOCUS_RING} ${
              sortActive ? filterActiveClass : filterIdleClass
            }`}
          >
            <ArrowUpDown className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
            <span className="truncate lg:hidden">{sortActive ? sortButtonLabel(state.sort) : "Sort"}</span>
            <span className="hidden truncate lg:inline">{sortLabel(state.sort)}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
          </button>
          {sortOpen ? (
            <div className="absolute right-0 top-full z-[60] mt-2 hidden w-56 rounded-control border border-line bg-white p-1.5 shadow-card lg:block">
              {sortOptionsList(selectSort)}
            </div>
          ) : null}
        </div>
      </div>

      {sortSheetMounted
        ? createPortal(
            <BottomSheet
              isOpen={sortOpen}
              onClose={() => setSortOpen(false)}
              title="Sort by"
              closeLabel="Close sort options"
              id="marketplace-sort-sheet"
            >
              <div className="space-y-1">{sortOptionsList(selectSort)}</div>
            </BottomSheet>,
            document.body,
          )
        : null}

      {filterCount > 0 ? (
        <div className="mt-2 flex flex-wrap justify-start gap-2 lg:justify-end">
          {state.types.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => removeType(type)}
              className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary"
            >
              {categoryChipLabel([type])}
              <X className="h-3 w-3" aria-hidden />
            </button>
          ))}
          {state.location.trim() ? (
            <button
              type="button"
              onClick={clearLocation}
              className="inline-flex max-w-[12rem] items-center gap-1 truncate rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary"
            >
              <span className="truncate">{state.location.trim()}</span>
              <X className="h-3 w-3 shrink-0" aria-hidden />
            </button>
          ) : null}
          {budgetSummary ? (
            <button
              type="button"
              onClick={clearBudget}
              className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary"
            >
              {budgetSummary}
              <X className="h-3 w-3" aria-hidden />
            </button>
          ) : null}
        </div>
      ) : null}

      <Drawer
        isOpen={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filters"
        subtitle="Refine your vendor search"
        zIndexClassName="z-[110]"
        footer={
          <div className="flex flex-col gap-2">
            <Button type="button" shape="pill" className="w-full" onClick={applyFilters}>
              Show results
            </Button>
            {filterCount > 0 ||
            draftTypes.length > 0 ||
            draftLocation.trim() ||
            minStr ||
            maxStr ? (
              <Button
                type="button"
                variant="secondary"
                shape="pill"
                className="w-full"
                onClick={clearAllFilters}
              >
                Clear all
              </Button>
            ) : null}
          </div>
        }
      >
        <div className="space-y-8">
          <section>
            <h3 className="text-sm font-semibold text-ink">Category</h3>
            <div className="mt-3">
              <MarketplaceCategoryFilterFields
                types={draftTypes}
                onToggleType={(value) => {
                  setDraftTypes((prev) => {
                    const set = new Set(prev);
                    if (set.has(value)) set.delete(value);
                    else set.add(value);
                    return [...set];
                  });
                }}
              />
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-ink">Location</h3>
            <div className="mt-3">
              <LocationAutocompleteInput
                ariaLabel="City or area"
                value={draftLocation}
                onChange={setDraftLocation}
                enableSuggestions
                countryCode={state.country}
              />
              {onRequestCurrentLocation ? (
                <button
                  type="button"
                  disabled={geoLoading}
                  onClick={() => void handleUseCurrentLocation()}
                  className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline disabled:opacity-60"
                >
                  {geoLoading ? (
                    <LoadingSpinner size="sm" className="text-primary" />
                  ) : (
                    <LocateFixed className="h-3.5 w-3.5" aria-hidden />
                  )}
                  Use current location
                </button>
              ) : null}
              {geoError ? (
                <p className="mt-2 text-xs font-medium text-danger">{geoError}</p>
              ) : null}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-ink">
              {budgetFilterLabel(state.country)}
            </h3>
            <div className="mt-3 flex items-center gap-2">
              <input
                type="number"
                min={0}
                step={1}
                inputMode="decimal"
                value={minStr}
                onChange={(e) => {
                  setMinStr(e.target.value);
                  setBudgetError(null);
                }}
                placeholder={`Min (${currencySymbol})`}
                aria-label="Minimum budget"
                className="w-full rounded-control border border-line bg-surface-3 px-3 py-2 text-base text-ink outline-none ring-primary/15 focus:border-primary focus:bg-white focus:ring-2 md:text-sm"
              />
              <span className="text-ink-3">–</span>
              <input
                type="number"
                min={0}
                step={1}
                inputMode="decimal"
                value={maxStr}
                onChange={(e) => {
                  setMaxStr(e.target.value);
                  setBudgetError(null);
                }}
                placeholder={`Max (${currencySymbol})`}
                aria-label="Maximum budget"
                className="w-full rounded-control border border-line bg-surface-3 px-3 py-2 text-base text-ink outline-none ring-primary/15 focus:border-primary focus:bg-white focus:ring-2 md:text-sm"
              />
            </div>
            {budgetError ? (
              <p className="mt-2 text-xs font-medium text-danger">{budgetError}</p>
            ) : null}
          </section>
        </div>
      </Drawer>
    </>
  );
}
