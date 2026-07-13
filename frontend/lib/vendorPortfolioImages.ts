/** Public Supabase (or other) URLs saved under onboarding `portfolioFileNames`. */
export function portfolioImageUrlsFromPayload(
  payload: Record<string, unknown>,
): string[] {
  const raw = payload.portfolioFileNames;
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const url = item.trim();
    if (!/^https?:\/\//i.test(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out.slice(0, 20);
}

export function firstPortfolioImageUrlFromPayload(
  payload: Record<string, unknown>,
): string | null {
  const profile = payload.profileImageUrl;
  if (typeof profile === "string") {
    const url = profile.trim();
    if (/^https?:\/\//i.test(url)) return url;
  }
  return portfolioImageUrlsFromPayload(payload)[0] ?? null;
}
