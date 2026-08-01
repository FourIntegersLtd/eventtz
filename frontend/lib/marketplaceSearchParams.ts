import type { MarketplaceSort } from "@/lib/clientExploreApi";
import type { ClientSearchContext } from "@/lib/clientBookingsApi";
import { DEFAULT_COUNTRY_CODE, normalizeCountryCode } from "@/lib/markets";

export type MarketplaceSearchState = {
  query: string;
  types: string[];
  location: string;
  country: string;
  dates: string[];
  dateFlexible: boolean;
  budgetMin: number | null;
  budgetMax: number | null;
  sort: MarketplaceSort;
  /** 1-based page; browse search pages 6 vendors from the API. */
  page: number;
  /** Limit results to these vendor user ids (planner handoff). */
  vendorIds: string[];
  /** Celebration plan id when arriving from AI planner. */
  fromPlannerPlanId: string | null;
  /** Event prefill from planner handoff (survives filter changes). */
  eventName: string;
  venue: string;
  planNotes: string;
  /** Linked client_events id - bookings attach to this celebration. */
  linkedEventId: string | null;
};

/** Vendors requested per browse page (backend `limit`). */
export const MARKETPLACE_PAGE_SIZE = 6;

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
  const country = normalizeCountryCode(sp.get("country") ?? DEFAULT_COUNTRY_CODE);
  const pageRaw = Number.parseInt(sp.get("page") ?? "1", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  const vendorIdsRaw = sp.get("vendor_ids");
  const vendorIds = vendorIdsRaw
    ? vendorIdsRaw
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    : [];

  return {
    query: q || legacyLocation,
    types,
    location: legacyLocation && q ? legacyLocation : "",
    country,
    dates,
    dateFlexible: parseBool(sp.get("flexible")),
    budgetMin: parseNum(sp.get("budget_min")),
    budgetMax: parseNum(sp.get("budget_max")),
    sort: parseSort(sp.get("sort")),
    page,
    vendorIds,
    fromPlannerPlanId: sp.get("fromPlanner")?.trim() || null,
    eventName: sp.get("eventName")?.trim() ?? "",
    venue: sp.get("venue")?.trim() ?? "",
    planNotes: sp.get("planNotes")?.trim() ?? "",
    linkedEventId: sp.get("event_id")?.trim() || null,
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
  if (state.country && state.country !== DEFAULT_COUNTRY_CODE) {
    sp.set("country", state.country);
  }
  if (state.dates.length > 0 && !state.dateFlexible) {
    sp.set("dates", state.dates.slice(0, 3).join(","));
  }
  if (state.dateFlexible) sp.set("flexible", "1");
  if (state.budgetMin != null) sp.set("budget_min", String(state.budgetMin));
  if (state.budgetMax != null) sp.set("budget_max", String(state.budgetMax));
  if (state.sort !== "relevance") sp.set("sort", state.sort);
  if (state.page > 1) sp.set("page", String(state.page));
  if (state.vendorIds.length > 0) sp.set("vendor_ids", state.vendorIds.join(","));
  if (state.fromPlannerPlanId) sp.set("fromPlanner", state.fromPlannerPlanId);
  if (state.eventName.trim()) sp.set("eventName", state.eventName.trim());
  if (state.venue.trim()) sp.set("venue", state.venue.trim());
  if (state.planNotes.trim()) sp.set("planNotes", state.planNotes.trim());
  if (state.linkedEventId) sp.set("event_id", state.linkedEventId);
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

/** Persist on booking create for 24h alternative-vendor nudges. */
export function toClientSearchContext(state: MarketplaceSearchState): ClientSearchContext {
  return {
    q: state.query.trim() || undefined,
    types: state.types.length ? state.types : undefined,
    location: state.location.trim() || undefined,
    country: state.country || undefined,
    dates: state.dates.length ? state.dates : undefined,
    dateFlexible: state.dateFlexible || undefined,
  };
}
