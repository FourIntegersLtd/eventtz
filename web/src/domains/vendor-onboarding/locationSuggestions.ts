/**
 * Place-name helpers for the location step.
 *
 * Photon address search is not wired here. Suggestions stay empty, so the
 * field is the plain text input the baseline uses when search is off.
 */

import type { MarketConfig } from "@/domains/vendor-onboarding/markets";

/** One city or area suggestion. Always empty until a place search is connected. */
export type LocationSuggestion = { label: string; value: string };

/** No remote place search. The field stays free text. */
export async function fetchLocationSuggestions(
  _query: string,
  _options?: { countryCode?: string },
): Promise<LocationSuggestion[]> {
  return [];
}

/** Travel-radius choices labelled in the market's distance unit. */
export function radiusOptionsForMarket(market: MarketConfig): {
  value: string;
  label: string;
  context: string;
}[] {
  const unit = market.distanceUnit === "km" ? "km" : "miles";
  return [
    { value: "under_50", label: `Under 50 ${unit}`, context: "About a 1-hour drive" },
    { value: "from_50_to_100", label: `50-100 ${unit}`, context: "Roughly 1-2 hours' drive" },
    { value: "from_100_to_200", label: `100-200 ${unit}`, context: "Roughly 2-4 hours' drive" },
    { value: "over_200", label: `Over 200 ${unit}`, context: "Long-distance - nationwide reach" },
  ];
}
