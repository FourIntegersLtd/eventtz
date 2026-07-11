import type { MarketplaceSort } from "@/lib/clientExploreApi";

export type MarketplaceSearchState = {
  query: string;
  types: string[];
  location: string;
  dates: string[];
  dateFlexible: boolean;
  budgetMin: number | null;
  budgetMax: number | null;
  sort: MarketplaceSort;
};

const SORT_VALUES: MarketplaceSort[] = [
  "relevance",
  "price_asc",
  "price_desc",
  "proximity",
  "rating",
];

function parseBool(v: string | null): boolean {
  return v === "1" || v === "true" || v === "yes";
}

function parseNum(v: string | null): number | null {
  if (v == null || v.trim() === "") return null;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

export function parseSort(raw: string | null): MarketplaceSort {
  const s = (raw ?? "").trim().toLowerCase();
  if (SORT_VALUES.includes(s as MarketplaceSort)) return s as MarketplaceSort;
  return "relevance";
}

/** Hydrate marketplace search state from URL search params (e.g. `/explore?…`). */
export function marketplaceStateFromSearchParams(
  sp: URLSearchParams,
): MarketplaceSearchState {
  const typesRaw = sp.get("types");
  const types = typesRaw
    ? typesRaw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  const datesRaw = sp.get("dates");
  const dates = datesRaw
    ? datesRaw
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean)
        .slice(0, 3)
    : [];

  const legacyLocation = sp.get("location")?.trim() ?? "";
  const q = sp.get("q")?.trim() ?? "";

  return {
    query: q || legacyLocation,
    types,
    location: "",
    dates,
    dateFlexible: parseBool(sp.get("flexible")),
    budgetMin: parseNum(sp.get("budget_min")),
    budgetMax: parseNum(sp.get("budget_max")),
    sort: parseSort(sp.get("sort")),
  };
}

export function buildMarketplaceSearchUrl(
  path: string,
  state: MarketplaceSearchState,
): string {
  const sp = new URLSearchParams();
  const q = state.query.trim();
  if (q) sp.set("q", q);
  if (state.types.length > 0) sp.set("types", state.types.join(","));
  if (state.location.trim()) sp.set("location", state.location.trim());
  if (state.dates.length > 0 && !state.dateFlexible) {
    sp.set("dates", state.dates.slice(0, 3).join(","));
  }
  if (state.dateFlexible) sp.set("flexible", "1");
  if (state.budgetMin != null) sp.set("budget_min", String(state.budgetMin));
  if (state.budgetMax != null) sp.set("budget_max", String(state.budgetMax));
  if (state.sort !== "relevance") sp.set("sort", state.sort);
  const queryString = sp.toString();
  return queryString ? `${path}?${queryString}` : path;
}

/** Carry marketplace filters onto client vendor detail so the booking modal can prefill dates. */
export function buildClientBrowseVendorUrl(
  vendorUserId: string,
  state: MarketplaceSearchState,
): string {
  return buildMarketplaceSearchUrl(`/client/browse/${vendorUserId}`, state);
}
