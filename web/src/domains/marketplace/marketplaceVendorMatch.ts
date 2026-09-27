/**
 * Re-validate marketplace URL filters against a vendor (same rules as explore search).
 * Ported from the baseline `marketplaceVendorMatch.ts`, simplified to the parts
 * of the baseline whose dependencies are already in web/.
 */
import type { ExploreVendorSearchRow } from "./api";
import type { MarketplaceSearchState } from "./marketplaceSearchParams";

function servicesOffered(payload: Record<string, unknown>): string[] {
  const raw = payload.servicesOffered;
  if (!Array.isArray(raw)) return [];
  return raw.map(String).map((s) => s.trim()).filter(Boolean);
}

/** Substring match against city, business name, services — mirrors backend search. */
function locationMatchesVendor(
  locationQuery: string,
  vendor: ExploreVendorSearchRow,
  payload: Record<string, unknown>,
): boolean {
  const loc = locationQuery.trim().toLowerCase();
  if (!loc) return true;
  const baseCity = String(payload.baseCity ?? "").toLowerCase();
  const biz = String(payload.businessName ?? "").toLowerCase();
  const svcs = servicesOffered(payload).join(" ").toLowerCase();
  const email = String(vendor.email ?? "").toLowerCase();
  const hay = `${baseCity} ${biz} ${svcs} ${email}`;
  return hay.includes(loc);
}

export type MarketplaceVendorMatchResult = {
  matches: boolean;
  /** Non-empty when matches is false — for UI banner. */
  reasons: string[];
};

/**
 * Returns whether this vendor would appear in explore search with the same params
 * (types, location). Date availability and budget checks are omitted until their
 * dependencies (vendorAvailability, vendorDiscountDisplay) land in web/.
 */
export function vendorMatchesMarketplaceSearch(
  vendor: ExploreVendorSearchRow,
  state: MarketplaceSearchState,
): MarketplaceVendorMatchResult {
  const reasons: string[] = [];
  const payload =
    typeof vendor.profile_form_data === "object" && vendor.profile_form_data !== null && !Array.isArray(vendor.profile_form_data)
      ? (vendor.profile_form_data as Record<string, unknown>)
      : {};

  const typeFilters = state.types.filter(Boolean);
  if (typeFilters.length > 0) {
    const svcs = new Set(servicesOffered(payload));
    const anyHit = typeFilters.some((serviceType) => svcs.has(serviceType));
    if (!anyHit) {
      reasons.push("This vendor doesn't match your selected service types.");
    }
  }

  if (!locationMatchesVendor(state.location, vendor, payload)) {
    reasons.push("This vendor doesn't match your location search.");
  }

  return { matches: reasons.length === 0, reasons };
}
