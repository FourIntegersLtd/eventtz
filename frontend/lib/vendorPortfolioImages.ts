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

export function profileImageUrlFromPayload(
  payload: Record<string, unknown>,
): string | null {
  const profile = payload.profileImageUrl;
  if (typeof profile === "string") {
    const url = profile.trim();
    if (/^https?:\/\//i.test(url)) return url;
  }
  return null;
}

function urlListFromPayload(
  payload: Record<string, unknown>,
  key: string,
): string[] {
  const raw = payload[key];
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const url = item.trim();
    if (!/^https?:\/\//i.test(url) || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

/** Admin drag order stored on vendor payload (may include hidden URLs). */
export function listingDisplayOrderFromPayload(
  payload: Record<string, unknown>,
): string[] {
  return urlListFromPayload(payload, "listingDisplayOrder");
}

/** Admin-hidden URLs stored on vendor payload. */
export function listingHiddenImageUrlsFromPayload(
  payload: Record<string, unknown>,
): string[] {
  return urlListFromPayload(payload, "listingHiddenImageUrls");
}

/** @deprecated Legacy admin cover override; read-time fallback only. */
export function listingCoverOverrideFromPayload(
  payload: Record<string, unknown>,
): string | null {
  const raw = payload.listingCoverImageUrl;
  if (typeof raw !== "string") return null;
  const url = raw.trim();
  return /^https?:\/\//i.test(url) ? url : null;
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
    if (portfolio.includes(profile)) {
      return [profile, ...portfolio.filter((url) => url !== profile)];
    }
    return [profile, ...portfolio];
  }
  return portfolio;
}

function baseListingDisplayOrder(payload: Record<string, unknown>): string[] {
  const stored = listingDisplayOrderFromPayload(payload);
  if (stored.length > 0) return stored;
  const legacy = listingCoverOverrideFromPayload(payload);
  const fallback = defaultListingDisplayOrder(payload);
  if (legacy) {
    return [legacy, ...fallback.filter((url) => url !== legacy)];
  }
  return fallback;
}

/** Resolved public gallery/card order after admin overrides and hidden filter. */
export function publicListingImageUrlsFromPayload(
  payload: Record<string, unknown>,
): string[] {
  const allowed = allowedListingMediaUrls(payload);
  const hidden = new Set(listingHiddenImageUrlsFromPayload(payload));
  const baseOrder = baseListingDisplayOrder(payload);
  const fallback = defaultListingDisplayOrder(payload);
  const ordered: string[] = [];
  const seen = new Set<string>();

  for (const url of baseOrder) {
    if (!allowed.has(url) || hidden.has(url) || seen.has(url)) continue;
    seen.add(url);
    ordered.push(url);
  }
  for (const url of fallback) {
    if (!allowed.has(url) || hidden.has(url) || seen.has(url)) continue;
    seen.add(url);
    ordered.push(url);
  }
  return ordered;
}

/** Listing cover is the first visible image in resolved public order. */
export function listingCoverImageUrlFromPayload(
  payload: Record<string, unknown>,
): string | null {
  return publicListingImageUrlsFromPayload(payload)[0] ?? null;
}

/** Gallery order matches public listing order (cover is first visible image). */
export function portfolioImageUrlsForDisplay(
  payload: Record<string, unknown>,
): string[] {
  return publicListingImageUrlsFromPayload(payload);
}

export type AdminListingMediaItem = {
  url: string;
  hidden: boolean;
  label: string;
};

/** Build admin editor items preserving stored drag order and hidden flags. */
export function adminListingMediaItemsFromPayload(
  payload: Record<string, unknown>,
): AdminListingMediaItem[] {
  const profile = profileImageUrlFromPayload(payload);
  const hidden = new Set(listingHiddenImageUrlsFromPayload(payload));
  const storedOrder = listingDisplayOrderFromPayload(payload);
  const fallback = defaultListingDisplayOrder(payload);
  const order = storedOrder.length > 0 ? storedOrder : fallback;
  const seen = new Set<string>();
  const items: AdminListingMediaItem[] = [];

  const labelFor = (url: string): string => {
    if (profile && url === profile) return "Profile photo";
    return `Portfolio ${items.length + 1}`;
  };

  for (const url of order) {
    if (seen.has(url)) continue;
    seen.add(url);
    items.push({
      url,
      hidden: hidden.has(url),
      label: labelFor(url),
    });
  }
  for (const url of fallback) {
    if (seen.has(url)) continue;
    seen.add(url);
    items.push({
      url,
      hidden: hidden.has(url),
      label: labelFor(url),
    });
  }
  return items;
}

export function adminListingMediaStateFromItems(
  items: AdminListingMediaItem[],
): { displayOrder: string[]; hiddenImageUrls: string[] } {
  const displayOrder = items.map((item) => item.url);
  const hiddenImageUrls = items.filter((item) => item.hidden).map((item) => item.url);
  return { displayOrder, hiddenImageUrls };
}

export function adminListingMediaMatchesDefault(
  items: AdminListingMediaItem[],
  payload: Record<string, unknown>,
): boolean {
  if (items.some((item) => item.hidden)) return false;
  const urls = items.map((item) => item.url);
  const fallback = defaultListingDisplayOrder(payload);
  if (urls.length !== fallback.length) return false;
  return urls.every((url, index) => url === fallback[index]);
}

/** @deprecated Prefer `listingCoverImageUrlFromPayload`. */
export function firstPortfolioImageUrlFromPayload(
  payload: Record<string, unknown>,
): string | null {
  return listingCoverImageUrlFromPayload(payload);
}
