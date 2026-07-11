/**
 * UK-focused place suggestions via Photon (Komoot), filtered to countrycode gb.
 * https://photon.komoot.io — public; respect fair use (debounce, don’t hammer).
 */

export type LocationSuggestion = { label: string; value: string };

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

/** Bias search to Great Britain (still filter by countrycode). */
const UK_BBOX = "-8.2,49.5,2.5,61.0";

export async function fetchUkLocationSuggestions(
  query: string,
): Promise<LocationSuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=14&lang=en&bbox=${UK_BBOX}`;
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
    if (cc && cc !== "gb") continue;

    const label = formatPhotonLabel(p);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label, value: label });
    if (out.length >= 8) break;
  }

  return out;
}
