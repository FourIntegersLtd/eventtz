/**
 * Country-scoped place suggestions via Photon (Komoot).
 * https://photon.komoot.io — public; respect fair use (debounce, don't hammer).
 */

import {
  DEFAULT_COUNTRY_CODE,
  getMarket,
  normalizeCountryCode,
  type MarketConfig,
} from "@/lib/markets";

export type LocationSuggestion = { label: string; value: string };

/** Photon bounding boxes by country (approximate). */
const PHOTON_BBOX: Record<string, string> = {
  GB: "-8.2,49.5,2.5,61.0",
};

function formatPhotonLabel(p: Record<string, unknown>): string {
  const name = typeof p.name === "string" ? p.name.trim() : "";
  const city = typeof p.city === "string" ? p.city.trim() : "";
  const town = typeof p.town === "string" ? p.town.trim() : "";
  const state = typeof p.state === "string" ? p.state.trim() : "";
  const county = typeof p.county === "string" ? p.county.trim() : "";
  const primary = name || city || town;
  const secondary = state || county;
  if (primary && secondary && primary.toLowerCase() !== secondary.toLowerCase()) {
    return `${primary}, ${secondary}`;
  }
  return primary || "";
}

export type LocationSuggestionOptions = {
  countryCode?: string;
  limit?: number;
};

/** @deprecated Use fetchLocationSuggestions */
export async function fetchUkLocationSuggestions(
  query: string,
): Promise<LocationSuggestion[]> {
  return fetchLocationSuggestions(query, { countryCode: DEFAULT_COUNTRY_CODE });
}

export async function fetchLocationSuggestions(
  query: string,
  options: LocationSuggestionOptions = {},
): Promise<LocationSuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const countryCode = normalizeCountryCode(options.countryCode);
  const market = getMarket(countryCode);
  const ccFilter = market.countryCode.toLowerCase();
  const bbox = PHOTON_BBOX[countryCode];
  const limit = options.limit ?? 14;
  const maxResults = options.limit ?? 8;

  const params = new URLSearchParams({
    q,
    limit: String(limit),
    lang: "en",
  });
  if (bbox) params.set("bbox", bbox);

  const url = `https://photon.komoot.io/api/?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) return [];

  const data = (await res.json()) as {
    features?: Array<{ properties: Record<string, unknown> }>;
  };
  const features = data.features ?? [];
  const seen = new Set<string>();
  const out: LocationSuggestion[] = [];

  for (const f of features) {
    const p = f.properties;
    const cc = typeof p.countrycode === "string" ? p.countrycode.toLowerCase() : "";
    if (cc && cc !== ccFilter) continue;

    const label = formatPhotonLabel(p);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label, value: label });
    if (out.length >= maxResults) break;
  }

  return out;
}

export function radiusOptionsForMarket(market: MarketConfig): {
  value: string;
  label: string;
  context: string;
}[] {
  const unit = market.distanceUnit === "km" ? "km" : "miles";
  const drive = market.distanceUnit === "km" ? "drive" : "drive";
  return [
    { value: "under_50", label: `Under 50 ${unit}`, context: `About a 1-hour ${drive}` },
    {
      value: "from_50_to_100",
      label: `50–100 ${unit}`,
      context: `Roughly 1–2 hours' ${drive}`,
    },
    {
      value: "from_100_to_200",
      label: `100–200 ${unit}`,
      context: `Roughly 2–4 hours' ${drive}`,
    },
    {
      value: "over_200",
      label: `Over 200 ${unit}`,
      context: "Long-distance — nationwide reach",
    },
  ];
}
