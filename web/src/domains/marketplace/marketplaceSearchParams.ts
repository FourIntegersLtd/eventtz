/**
 * Marketplace URL query parsers and serialisers.
 * Ported from the baseline `marketplaceSearchParams.ts`.
 */
import type { MarketplaceSort } from "./api";
import { VENDOR_SERVICE_OPTIONS } from "./vendorServiceOptions";
import { DEFAULT_COUNTRY_CODE, normalizeCountryCode } from "./markets";

const ALLOWED_VENDOR_SERVICE_TYPES = new Set(
  VENDOR_SERVICE_OPTIONS.map((option) => option.value),
);

function filterVendorServiceTypes(raw: string[]): string[] {
  const out: string[] = [];
  for (const item of raw) {
    const key = item.trim().toLowerCase();
    if (ALLOWED_VENDOR_SERVICE_TYPES.has(key) && !out.includes(key)) {
      out.push(key);
    }
  }
  return out;
}

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
  vendorIds: string[];
  fromPlannerPlanId: string | null;
  eventName: string;
  venue: string;
  planNotes: string;
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

function parseBool(value: string | null): boolean {
  return value === "1" || value === "true" || value === "yes";
}

function parseNumber(value: string | null): number | null {
  if (value == null || value.trim() === "") return null;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

export function parseSort(raw: string | null): MarketplaceSort {
  const s = (raw ?? "").trim().toLowerCase();
  if ((SORT_VALUES as readonly string[]).includes(s)) return s as MarketplaceSort;
  return "relevance";
}

/** Hydrate marketplace search state from URL search params. */
export function marketplaceStateFromSearchParams(
  sp: URLSearchParams,
): MarketplaceSearchState {
  const typesRaw = sp.get("types");
  const types = typesRaw
    ? filterVendorServiceTypes(typesRaw.split(",").map((t) => t.trim()).filter(Boolean))
    : [];

  const datesRaw = sp.get("dates");
  const dates = datesRaw
    ? datesRaw.split(",").map((d) => d.trim()).filter(Boolean).slice(0, 3)
    : [];

  const legacyLocation = sp.get("location")?.trim() ?? "";
  const q = sp.get("q")?.trim() ?? "";
  const country = normalizeCountryCode(sp.get("country") ?? DEFAULT_COUNTRY_CODE);
  const pageRaw = Number.parseInt(sp.get("page") ?? "1", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  const vendorIdsRaw = sp.get("vendor_ids");
  const vendorIds = vendorIdsRaw
    ? vendorIdsRaw.split(",").map((id) => id.trim()).filter(Boolean)
    : [];

  return {
    query: q,
    types,
    location: legacyLocation,
    country,
    dates,
    dateFlexible: parseBool(sp.get("flexible")),
    budgetMin: parseNumber(sp.get("budget_min")),
    budgetMax: parseNumber(sp.get("budget_max")),
    sort: parseSort(sp.get("sort") ?? "relevance"),
    page,
    vendorIds,
    fromPlannerPlanId: sp.get("fromPlanner")?.trim() ?? null,
    eventName: sp.get("eventName")?.trim() ?? "",
    venue: sp.get("venue")?.trim() ?? "",
    planNotes: sp.get("planNotes")?.trim() ?? "",
    linkedEventId: sp.get("event_id")?.trim() ?? null,
  };
}

/** Serialise marketplace search state onto a path. */
export function buildMarketplaceSearchUrl(
  path: string,
  state: MarketplaceSearchState,
): string {
  const sp = new URLSearchParams();
  if (state.query.trim()) sp.set("q", state.query.trim());
  if (state.types.length > 0) sp.set("types", state.types.join(","));
  if (state.location.trim()) sp.set("location", state.location.trim());
  if (state.country !== DEFAULT_COUNTRY_CODE) sp.set("country", state.country);
  if (state.dates.length > 0 && !state.dateFlexible) sp.set("dates", state.dates.join(","));
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
  const qs = sp.toString();
  return qs ? `${path}?${qs}` : path;
}

/** Carry marketplace filters onto client vendor detail. */
export function buildClientBrowseVendorUrl(
  vendorUserId: string,
  state: MarketplaceSearchState,
): string {
  return buildMarketplaceSearchUrl(`/client/browse/${vendorUserId}`, state);
}

/** Dates from browse filters for booking modal prefill. */
export type MarketplaceBookingSearchPrefill = {
  eventDate: string;
  eventEndDate?: string;
  datesFlexible: boolean;
};

export function marketplaceSearchPrefillFromState(
  state: MarketplaceSearchState,
): MarketplaceBookingSearchPrefill {
  const dates = state.dates;
  const first = dates[0];
  let eventEndDate: string | undefined;
  if (dates.length === 2 && first && dates[1] && dates[1] >= first) {
    eventEndDate = dates[1];
  }
  return {
    eventDate: first ?? "",
    eventEndDate,
    datesFlexible: state.dateFlexible,
  };
}

export type ClientSearchContext = {
  q?: string;
  types?: string[];
  location?: string;
  country?: string;
  dates?: string[];
  dateFlexible?: boolean;
  source?: "browse" | "planner" | "multi";
  plannerPlanId?: string;
  /** How many vendors share this brief. Set only on a multi-vendor send. */
  batchSize?: number;
  /** Zero-based place of this vendor in that send. */
  batchIndex?: number;
};

function toClientSearchContext(state: MarketplaceSearchState): ClientSearchContext {
  return {
    q: state.query.trim() || undefined,
    types: state.types.length ? state.types : undefined,
    location: state.location.trim() || undefined,
    country: state.country || undefined,
    dates: state.dates.length ? state.dates : undefined,
    dateFlexible: state.dateFlexible || undefined,
  };
}

/**
 * Event fields a planner (or other deep link) left on the browse URL.
 * Empty when the URL has none of them.
 */
export type EventEnquirePrefill = {
  eventName: string;
  eventDate: string;
  eventEndDate: string;
  venueAddress: string;
  notes: string;
};

/** Planner query params (`eventName`, `venue`, `planNotes`, `dates`) as form defaults. */
export function eventEnquirePrefillFromMarketplaceState(
  state: MarketplaceSearchState,
): EventEnquirePrefill | null {
  const eventName = state.eventName.trim();
  const venueAddress = state.venue.trim();
  const notes = state.planNotes.trim();
  const eventDate = state.dates[0]?.trim() ?? "";
  const eventEndDate = state.dates[1]?.trim() ?? "";
  if (!eventName && !eventDate && !venueAddress && !notes) return null;
  return { eventName, eventDate, eventEndDate, venueAddress, notes };
}

/** Browse filters plus optional planner handoff for booking analytics context. */
export function clientSearchContextFromBrowse(
  state: MarketplaceSearchState,
  searchParams?: URLSearchParams | null,
): ClientSearchContext {
  const base = toClientSearchContext(state);
  const planId =
    state.fromPlannerPlanId?.trim() ||
    searchParams?.get("fromPlanner")?.trim() ||
    null;
  // The baseline stores no `source` for a plain browse; only a planner handoff is tagged.
  if (!planId) return base;
  return { ...base, source: "planner", plannerPlanId: planId };
}

/** Map URL marketplace state to the explore search API query params. */
export function marketplaceStateToExploreQuery(
  state: MarketplaceSearchState,
  options?: {
    vendorIds?: string[];
    limit?: number;
    offset?: number;
  },
): {
  query?: string;
  types?: string;
  location?: string;
  country?: string;
  dates?: string;
  flexible?: boolean;
  budget_min?: number;
  budget_max?: number;
  sort?: string;
  vendor_ids?: string;
  limit?: number;
  offset?: number;
} {
  return {
    query: state.query || undefined,
    types: state.types.length ? state.types.join(",") : undefined,
    location: state.location || undefined,
    country: state.country,
    dates: state.dates.length ? state.dates.join(",") : undefined,
    flexible: state.dateFlexible,
    budget_min: state.budgetMin ?? undefined,
    budget_max: state.budgetMax ?? undefined,
    sort: state.sort,
    vendor_ids: options?.vendorIds?.join(",") || undefined,
    limit: options?.limit,
    offset: options?.offset,
  };
}
