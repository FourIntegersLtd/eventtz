"use client";

import { useState } from "react";
import type { MarketplaceSort } from "./api";
import {
  categoryChipLabel,
  MarketplaceCategoryFilterFields,
} from "./MarketplaceCategoryFilterFields";
import { MarketplaceDateFilterFields } from "./MarketplaceDateFilterFields";
import type { MarketplaceSearchState } from "./marketplaceSearchParams";
import {
  buildMarketplaceClearedFilterState,
  marketplaceActiveFilterCount,
} from "./marketplaceFilterState";
import {
  budgetFilterLabel,
  formatCurrencySymbol,
  formatMoney,
  getMarket,
} from "./markets";
import { validateMarketplaceBudget } from "./marketplaceBudgetValidation";
import { useCategoryVendorCounts } from "./useCategoryVendorCounts";
import { Button, TextField } from "@/foundation/ui";

const SORT_OPTIONS: { value: MarketplaceSort; label: string }[] = [
  { value: "relevance", label: "Relevance" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "proximity", label: "Proximity" },
  { value: "rating", label: "Rating" },
];

type MarketplaceFiltersBarProps = {
  state: MarketplaceSearchState;
  onCommit: (next: MarketplaceSearchState) => void;
};

function budgetStringFromState(value: number | null): string {
  return value != null ? String(value) : "";
}

/** Browse filters: search, category, location, dates, budget, sort, and clear. */
export function MarketplaceFiltersBar({ state, onCommit }: MarketplaceFiltersBarProps) {
  const [extraOpen, setExtraOpen] = useState(false);
  const [budgetError, setBudgetError] = useState<string | null>(null);

  const [committedQuery, setCommittedQuery] = useState(state.query);
  const [queryDraft, setQueryDraft] = useState(state.query);
  if (state.query !== committedQuery) {
    setCommittedQuery(state.query);
    setQueryDraft(state.query);
  }

  const [committedLocation, setCommittedLocation] = useState(state.location);
  const [locationDraft, setLocationDraft] = useState(state.location);
  if (state.location !== committedLocation) {
    setCommittedLocation(state.location);
    setLocationDraft(state.location);
  }

  const urlMinBudget = budgetStringFromState(state.budgetMin);
  const urlMaxBudget = budgetStringFromState(state.budgetMax);
  const [committedMinBudget, setCommittedMinBudget] = useState(urlMinBudget);
  const [minBudget, setMinBudget] = useState(urlMinBudget);
  if (urlMinBudget !== committedMinBudget) {
    setCommittedMinBudget(urlMinBudget);
    setMinBudget(urlMinBudget);
  }

  const [committedMaxBudget, setCommittedMaxBudget] = useState(urlMaxBudget);
  const [maxBudget, setMaxBudget] = useState(urlMaxBudget);
  if (urlMaxBudget !== committedMaxBudget) {
    setCommittedMaxBudget(urlMaxBudget);
    setMaxBudget(urlMaxBudget);
  }

  const { counts: categoryCounts } = useCategoryVendorCounts();
  const market = getMarket(state.country);
  const currencySymbol = formatCurrencySymbol(market.currency);
  const filterCount = marketplaceActiveFilterCount(state);

  const commitBudget = () => {
    const validated = validateMarketplaceBudget({ min: minBudget, max: maxBudget });
    if (!validated.ok) {
      setBudgetError(validated.formError);
      return;
    }
    setBudgetError(null);
    if (
      validated.budgetMin === state.budgetMin &&
      validated.budgetMax === state.budgetMax
    ) {
      return;
    }
    onCommit({
      ...state,
      budgetMin: validated.budgetMin,
      budgetMax: validated.budgetMax,
      page: 1,
    });
  };

  const commitLocation = () => {
    const trimmed = locationDraft.trim();
    if (trimmed === state.location.trim()) return;
    onCommit({ ...state, location: trimmed, page: 1 });
  };

  const clearAllFilters = () => {
    const cleared = buildMarketplaceClearedFilterState(state);
    onCommit(cleared);
    setLocationDraft("");
    setCommittedLocation("");
    setMinBudget("");
    setMaxBudget("");
    setCommittedMinBudget("");
    setCommittedMaxBudget("");
    setBudgetError(null);
  };

  const hasBudget = state.budgetMin != null || state.budgetMax != null;
  const budgetSummary = hasBudget
    ? `${state.budgetMin != null ? formatMoney(state.budgetMin, market.currency) : "any"}–${
        state.budgetMax != null ? formatMoney(state.budgetMax, market.currency) : "any"
      }`
    : null;

  return (
    <div className="mt-4 space-y-3">
      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          onCommit({ ...state, query: queryDraft.trim(), page: 1 });
        }}
      >
        <div className="min-w-0 flex-1">
          <TextField
            label="Search"
            name="marketplace-query"
            value={queryDraft}
            placeholder="Search vendors, e.g. wedding DJ in Manchester"
            onChange={(event) => setQueryDraft(event.target.value)}
          />
        </div>
        <Button type="submit" className="shrink-0 sm:mb-0">
          Search
        </Button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-neutral-700 sm:max-w-xs">
          <span className="shrink-0 font-medium">Sort</span>
          <select
            value={state.sort}
            onChange={(event) =>
              onCommit({ ...state, sort: event.target.value as MarketplaceSort, page: 1 })
            }
            className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            aria-label="Sort results"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 lg:hidden"
          aria-expanded={extraOpen}
          onClick={() => setExtraOpen((open) => !open)}
        >
          {extraOpen ? "Hide filters" : "More filters"}
          {filterCount > 0 ? ` (${filterCount})` : ""}
        </button>

        {filterCount > 0 ? (
          <button
            type="button"
            onClick={clearAllFilters}
            className="text-sm font-semibold text-primary hover:underline"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {filterCount > 0 ? (
        <div className="flex flex-wrap gap-2">
          {state.types.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() =>
                onCommit({
                  ...state,
                  types: state.types.filter((entry) => entry !== type),
                  page: 1,
                })
              }
              className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary"
            >
              {categoryChipLabel([type])}
              <span aria-hidden>&times;</span>
            </button>
          ))}
          {state.location.trim() ? (
            <button
              type="button"
              onClick={() => onCommit({ ...state, location: "", page: 1 })}
              className="inline-flex max-w-[12rem] items-center gap-1 truncate rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary"
            >
              <span className="truncate">{state.location.trim()}</span>
              <span aria-hidden>&times;</span>
            </button>
          ) : null}
          {budgetSummary ? (
            <button
              type="button"
              onClick={() => onCommit({ ...state, budgetMin: null, budgetMax: null, page: 1 })}
              className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary"
            >
              {budgetSummary}
              <span aria-hidden>&times;</span>
            </button>
          ) : null}
        </div>
      ) : null}

      <div className={`space-y-6 ${extraOpen ? "block" : "hidden lg:block"}`}>
        <section>
          <h3 className="text-sm font-semibold text-neutral-900">Category</h3>
          <div className="mt-3">
            <MarketplaceCategoryFilterFields
              types={state.types}
              categoryCounts={categoryCounts}
              onToggleType={(value) => {
                const nextTypes = state.types.includes(value)
                  ? state.types.filter((entry) => entry !== value)
                  : [...state.types, value];
                onCommit({ ...state, types: nextTypes, page: 1 });
              }}
            />
          </div>
        </section>

        <section>
          <TextField
            label="Location"
            name="marketplace-location"
            value={locationDraft}
            placeholder="City or area"
            onChange={(event) => setLocationDraft(event.target.value)}
            onBlur={commitLocation}
          />
        </section>

        <section>
          <h3 className="text-sm font-semibold text-neutral-900">Dates</h3>
          <div className="mt-3">
            <MarketplaceDateFilterFields
              dates={state.dates}
              dateFlexible={state.dateFlexible}
              onChange={(next) =>
                onCommit({ ...state, dates: next.dates, dateFlexible: next.dateFlexible, page: 1 })
              }
            />
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-neutral-900">
            {budgetFilterLabel(state.country)}
          </h3>
          <div className="mt-3 flex items-center gap-2">
            <input
              type="number"
              min={0}
              step={1}
              inputMode="decimal"
              value={minBudget}
              onChange={(event) => {
                setMinBudget(event.target.value);
                setBudgetError(null);
              }}
              onBlur={commitBudget}
              placeholder={`Min (${currencySymbol})`}
              aria-label="Minimum budget"
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-base text-neutral-900 outline-none ring-primary/15 focus:border-primary focus:bg-white focus:ring-2 md:text-sm"
            />
            <span className="text-neutral-400">–</span>
            <input
              type="number"
              min={0}
              step={1}
              inputMode="decimal"
              value={maxBudget}
              onChange={(event) => {
                setMaxBudget(event.target.value);
                setBudgetError(null);
              }}
              onBlur={commitBudget}
              placeholder={`Max (${currencySymbol})`}
              aria-label="Maximum budget"
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-base text-neutral-900 outline-none ring-primary/15 focus:border-primary focus:bg-white focus:ring-2 md:text-sm"
            />
          </div>
          {budgetError ? (
            <p className="mt-2 text-xs font-medium text-red-600">{budgetError}</p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
