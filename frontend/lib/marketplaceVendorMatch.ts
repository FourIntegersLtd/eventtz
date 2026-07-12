/**
 * Re-validate marketplace URL filters against a vendor (same rules as explore search).
 * Used on vendor detail when arriving with ?types=&location=&dates=&flexible=…
 */

import type { MarketplaceSearchState } from "@/lib/marketplaceSearchParams";
import type { ExploreVendor } from "@/lib/clientExploreApi";
import { vendorPayloadAllowsEventDates } from "@/lib/vendorAvailability";
import {
  listPriceDisplay,
  parseVendorDiscountConfig,
} from "@/lib/vendorDiscountDisplay";

function parseMoneyGbp(raw: unknown): number | null {
  if (raw == null || typeof raw !== "string") return null;
  const t = raw.replace(/[^0-9.]/g, "");
  if (!t) return null;
  const n = Number.parseFloat(t);
  return Number.isFinite(n) && n >= 0 && n < 1e9 ? n : null;
}

function minListingPriceGbp(payload: Record<string, unknown>): number | null {
  const discountConfig = parseVendorDiscountConfig(payload);
  const candidates: number[] = [];

  const addListPrice = (raw: unknown) => {
    const listPrice = parseMoneyGbp(raw);
    if (listPrice == null) return;
    const priced = listPriceDisplay(listPrice, discountConfig);
    if (priced.unitPriceGbp != null) candidates.push(priced.unitPriceGbp);
  };

  addListPrice(payload.hourlyRate);
  addListPrice(payload.dailyRate);

  const pkgs = payload.packages;
  if (Array.isArray(pkgs)) {
    for (const item of pkgs) {
      if (!item || typeof item !== "object") continue;
      addListPrice((item as { price?: unknown }).price);
    }
  }

  if (candidates.length === 0) return null;
  return Math.min(...candidates);
}

function servicesOffered(payload: Record<string, unknown>): string[] {
  const raw = payload.servicesOffered;
  if (!Array.isArray(raw)) return [];
  return raw.map(String).map((s) => s.trim()).filter(Boolean);
}

/** Substring match against city, business name, services, email — mirrors backend search. */
function locationMatchesVendor(
  locationQuery: string,
  vendor: ExploreVendor,
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
 * (types, location, dates when not flexible, budget).
 */
export function vendorMatchesMarketplaceSearch(
  vendor: ExploreVendor,
  state: MarketplaceSearchState,
): MarketplaceVendorMatchResult {
  const reasons: string[] = [];
  const payload =
    typeof vendor.payload === "object" && vendor.payload !== null && !Array.isArray(vendor.payload)
      ? (vendor.payload as Record<string, unknown>)
      : {};

  const typeFilters = state.types.filter(Boolean);
  if (typeFilters.length > 0) {
    const svcs = new Set(servicesOffered(payload));
    const anyHit = typeFilters.some((t) => svcs.has(t));
    if (!anyHit) {
      reasons.push("This vendor doesn’t match your selected service types.");
    }
  }

  if (!locationMatchesVendor(state.location, vendor, payload)) {
    reasons.push("This vendor doesn’t match your location search.");
  }

  const dates = state.dates.filter(Boolean).slice(0, 3);
  if (!state.dateFlexible && dates.length > 0) {
    if (!vendorPayloadAllowsEventDates(payload, dates)) {
      reasons.push(
        "Your selected date(s) fall on days this vendor marked unavailable (blocked days or non-working weekdays).",
      );
    }
  }

  const minPrice = minListingPriceGbp(payload);
  if (state.budgetMin != null && minPrice != null && minPrice < state.budgetMin) {
    reasons.push(
      "This vendor’s lowest listed price is below the minimum budget you set in search.",
    );
  }
  if (state.budgetMax != null && minPrice != null && minPrice > state.budgetMax) {
    reasons.push(
      "This vendor’s lowest listed price is above the maximum budget you set in search.",
    );
  }

  return { matches: reasons.length === 0, reasons };
}
