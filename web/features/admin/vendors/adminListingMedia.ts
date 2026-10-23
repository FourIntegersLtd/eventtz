import type { AdminListingMediaSavePayload } from "@/lib/adminVendorsApi";
import {
  defaultListingDisplayOrder,
  listingDisplayOrderFromPayload,
  listingHiddenImageUrlsFromPayload,
  mergeUnique,
  profileImageUrlFromPayload,
} from "@/lib/vendorPortfolioImages";

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
  const fallback = defaultListingDisplayOrder(payload);
  // The saved order can still name a photo the vendor has since removed or replaced. The api
  // refuses any URL that is not the current profile photo or a portfolio image, so a drag that
  // sent the whole list back would fail: offer only the current photos.
  const order = mergeUnique(listingDisplayOrderFromPayload(payload), fallback, new Set(fallback));

  return order.map((url, index) => ({
    url,
    hidden: hidden.has(url),
    label: profile && url === profile ? "Profile photo" : `Portfolio ${index + 1}`,
  }));
}

/** What the listing-media PATCH sends for these items: their order and the hidden ones. */
export function adminListingMediaStateFromItems(
  items: AdminListingMediaItem[],
): AdminListingMediaSavePayload {
  return {
    displayOrder: items.map((item) => item.url),
    hiddenImageUrls: items.filter((item) => item.hidden).map((item) => item.url),
  };
}

/** True when nothing is hidden and the items are in the vendor's default order. */
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
