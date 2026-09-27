/**
 * Pure helpers for browse filter chips and "clear filters" behaviour.
 * Matches the baseline MarketplaceFiltersBar active count and cleared state.
 */
import type { MarketplaceSearchState } from "./marketplaceSearchParams";

/** Count of removable filter chips (types, location, budget — not dates or query). */
export function marketplaceActiveFilterCount(state: MarketplaceSearchState): number {
  let count = 0;
  if (state.types.length > 0) count += 1;
  if (state.location.trim()) count += 1;
  if (state.budgetMin != null || state.budgetMax != null) count += 1;
  return count;
}

/** Clear types, location, budget and sort; keep query, dates and other planner fields. */
export function buildMarketplaceClearedFilterState(
  state: MarketplaceSearchState,
): MarketplaceSearchState {
  return {
    ...state,
    types: [],
    location: "",
    budgetMin: null,
    budgetMax: null,
    sort: "relevance",
    page: 1,
  };
}
