import { SERVICE_OPTIONS } from "@/features/vendor/onboarding/constants";
import type { ExploreVendorSearchRow } from "@/lib/clientExploreApi";
import type { MarketplaceSearchState } from "@/lib/marketplaceSearchParams";

export type ExpandedSearchCard = {
  vendor: ExploreVendorSearchRow;
  /** Service tag this card highlights (duplicate rows when multiple types match). */
  highlightService: string | null;
  cardKey: string;
};

function labelForService(value: string): string {
  return (
    SERVICE_OPTIONS.find((o) => o.value === value)?.label ??
    value.replace(/_/g, " ")
  );
}

/**
 * One card per vendor. Highlight the first matched selected type (or first matched service).
 */
export function expandVendorsForSearchResults(
  vendors: ExploreVendorSearchRow[],
  selectedTypes: string[],
): ExpandedSearchCard[] {
  const out: ExpandedSearchCard[] = [];

  for (const v of vendors) {
    const matched = Array.isArray(v.matched_services) ? v.matched_services : [];
    const tier = v.match_tier ?? "exact";
    const softTier = tier === "related" || tier === "fallback";

    if (selectedTypes.length === 0) {
      out.push({
        vendor: v,
        highlightService: matched[0] ?? null,
        cardKey: v.user_id,
      });
      continue;
    }

    const types = matched.filter((t) => selectedTypes.includes(t));
    if (types.length === 0) {
      if (softTier) {
        out.push({
          vendor: v,
          highlightService: matched[0] ?? null,
          cardKey: `${v.user_id}::${tier}`,
        });
      }
      continue;
    }

    out.push({
      vendor: v,
      highlightService: types[0] ?? null,
      cardKey: v.user_id,
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

/** Headline line under the result count, e.g. “Top matches for Photography & Catering on 10 July 2026 in London”. */
export function buildMarketplaceResultsHeadline(
  state: MarketplaceSearchState,
): string {
  const typeLabels = state.types.map(labelForService);
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
