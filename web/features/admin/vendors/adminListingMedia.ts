import type { AdminListingMediaSavePayload } from "@/lib/adminVendorsApi";
import {
  defaultListingDisplayOrder,
  listingDisplayOrderFromPayload,
  listingHiddenImageUrlsFromPayload,
  profileImageUrlFromPayload,
} from "@/lib/vendorPortfolioImages";

export type AdminListingMediaItem = {
  url: string;
  hidden: boolean;
  label: string;
};

function mergeEditorOrder(preferred: string[], fallback: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of [...preferred, ...fallback]) {
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

/** Build admin editor items preserving stored drag order and hidden flags. */
export function adminListingMediaItemsFromPayload(
  payload: Record<string, unknown>,
): AdminListingMediaItem[] {
  const profile = profileImageUrlFromPayload(payload);
  const hidden = new Set(listingHiddenImageUrlsFromPayload(payload));
  const fallback = defaultListingDisplayOrder(payload);
  const stored = listingDisplayOrderFromPayload(payload);
  const order = mergeEditorOrder(stored, fallback);

  return order.map((url, index) => ({
    url,
    hidden: hidden.has(url),
    label: profile && url === profile ? "Profile photo" : `Portfolio ${index + 1}`,
  }));
}

export function adminListingMediaStateFromItems(
  items: AdminListingMediaItem[],
): AdminListingMediaSavePayload {
  return {
    displayOrder: items.map((item) => item.url),
    hiddenImageUrls: items.filter((item) => item.hidden).map((item) => item.url),
  };
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
