/**
 * Marketplace search model — card expansion and results headlines.
 * Ported from the baseline `marketplaceSearchModel.ts`.
 */
import type { ExploreVendorSearchRow } from "./api";
import type { MarketplaceSearchState } from "./marketplaceSearchParams";
import { labelForVendorService } from "./vendorServiceOptions";

export type ExpandedSearchCard = {
  vendor: ExploreVendorSearchRow;
  /** Service tag this card highlights (duplicate rows when multiple types match). */
  highlightService: string | null;
  cardKey: string;
};

/**
 * One card per vendor. Highlight the first matched selected type (or first matched service).
 */
export function expandVendorsForSearchResults(
  vendors: ExploreVendorSearchRow[],
  selectedTypes: string[],
): ExpandedSearchCard[] {
  const out: ExpandedSearchCard[] = [];

  for (const vendor of vendors) {
    const matched = Array.isArray(vendor.matched_services) ? vendor.matched_services : [];
    const tier = vendor.match_tier ?? "exact";
    const softTier = tier === "related" || tier === "fallback";

    if (selectedTypes.length === 0) {
      out.push({
        vendor,
        highlightService: matched[0] ?? null,
        cardKey: vendor.user_id,
      });
      continue;
    }

    const types = matched.filter((serviceType) => selectedTypes.includes(serviceType));
    if (types.length === 0) {
      if (softTier) {
        out.push({
          vendor,
          highlightService: matched[0] ?? null,
          cardKey: `${vendor.user_id}::${tier}`,
        });
      }
      continue;
    }

    out.push({
      vendor,
      highlightService: types[0] ?? null,
      cardKey: vendor.user_id,
    });
  }

  return out;
}

function formatShortDate(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Headline under the result count, e.g. "Top matches for Photography & Catering on 10 July 2026 in London". */
export function buildMarketplaceResultsHeadline(
  state: MarketplaceSearchState,
): string {
  const typeLabels = state.types.map(labelForVendorService);
  let typePart = "vendors";
  if (typeLabels.length === 1) {
    typePart = typeLabels[0] ?? "vendors";
  } else if (typeLabels.length > 1) {
    typePart = typeLabels.slice(0, -1).join(", ") + " & " + typeLabels[typeLabels.length - 1];
  }

  const loc = state.location.trim();
  const locPart = loc ? ` in ${loc}` : "";

  if (state.dateFlexible) {
    return `Top matches for ${typePart}${locPart}${state.types.length === 0 ? " (flexible on dates)" : ""}`.trim();
  }

  if (state.dates.length > 0) {
    const datesPretty = state.dates.map(formatShortDate).join(", ");
    return `Top matches for ${typePart} on ${datesPretty}${locPart}`;
  }

  return `Top matches for ${typePart}${locPart}`;
}
