const MAX_PORTFOLIO_IMAGES = 20;

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function httpUrlList(raw: unknown, limit?: number): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const url = item.trim();
    if (!isHttpUrl(url) || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
    if (limit != null && out.length >= limit) break;
  }
  return out;
}

function httpUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const url = raw.trim();
  return isHttpUrl(url) ? url : null;
}

/** Public S3 URLs saved under onboarding `portfolioFileNames`. */
export function portfolioImageUrlsFromPayload(
  payload: Record<string, unknown>,
): string[] {
  return httpUrlList(payload.portfolioFileNames, MAX_PORTFOLIO_IMAGES);
}

export function profileImageUrlFromPayload(
  payload: Record<string, unknown>,
): string | null {
  return httpUrl(payload.profileImageUrl);
}

function allowedListingMediaUrls(payload: Record<string, unknown>): Set<string> {
  const allowed = new Set<string>();
  const profile = profileImageUrlFromPayload(payload);
  if (profile) allowed.add(profile);
  for (const url of portfolioImageUrlsFromPayload(payload)) {
    allowed.add(url);
  }
  return allowed;
}

function mergeUnique(
  preferred: string[],
  fallback: string[],
  allowed: Set<string>,
  hidden?: Set<string>,
): string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const url of [...preferred, ...fallback]) {
    if (!allowed.has(url) || hidden?.has(url) || seen.has(url)) continue;
    seen.add(url);
    ordered.push(url);
  }
  return ordered;
}

/** Vendor default order: profile photo first, then portfolio. */
export function defaultListingDisplayOrder(
  payload: Record<string, unknown>,
): string[] {
  const allowed = allowedListingMediaUrls(payload);
  const profile = profileImageUrlFromPayload(payload);
  const portfolio = portfolioImageUrlsFromPayload(payload).filter((url) =>
    allowed.has(url),
  );
  if (profile && allowed.has(profile)) {
    return [profile, ...portfolio.filter((url) => url !== profile)];
  }
  return portfolio;
}

function baseListingDisplayOrder(payload: Record<string, unknown>): string[] {
  const stored = httpUrlList(payload.listingDisplayOrder);
  const fallback = defaultListingDisplayOrder(payload);
  if (stored.length > 0) return stored;
  const legacy = httpUrl(payload.listingCoverImageUrl);
  if (legacy) {
    return [legacy, ...fallback.filter((url) => url !== legacy)];
  }
  return fallback;
}

export function listingHiddenImageUrlsFromPayload(
  payload: Record<string, unknown>,
): string[] {
  return httpUrlList(payload.listingHiddenImageUrls);
}

/** Resolved public gallery/card order after admin overrides and hidden filter. */
export function publicListingImageUrlsFromPayload(
  payload: Record<string, unknown>,
): string[] {
  const allowed = allowedListingMediaUrls(payload);
  const hidden = new Set(listingHiddenImageUrlsFromPayload(payload));
  return mergeUnique(
    baseListingDisplayOrder(payload),
    defaultListingDisplayOrder(payload),
    allowed,
    hidden,
  );
}

/** Listing cover is the first visible image in resolved public order. */
export function listingCoverImageUrlFromPayload(
  payload: Record<string, unknown>,
): string | null {
  return publicListingImageUrlsFromPayload(payload)[0] ?? null;
}

/** Admin drag order including hidden URLs (editor, not public gallery). */
export function listingDisplayOrderFromPayload(
  payload: Record<string, unknown>,
): string[] {
  return httpUrlList(payload.listingDisplayOrder);
}
