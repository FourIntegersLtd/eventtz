/**
 * Whether browse/favorites should call explore search and which vendor ids to pass.
 */

export type MarketplaceExploreFetchDecision =
  | { shouldFetch: false }
  | { shouldFetch: true; vendorIds: string[] | undefined };

/** Decide explore search fetch scope for browse vs favorites. */
export function resolveMarketplaceExploreFetch(input: {
  savedOnly: boolean;
  bookmarksReady: boolean;
  savedVendorIds: ReadonlySet<string>;
  urlVendorIds: string[];
}): MarketplaceExploreFetchDecision {
  if (input.savedOnly) {
    if (!input.bookmarksReady) return { shouldFetch: false };
    if (input.savedVendorIds.size === 0) return { shouldFetch: false };
    return { shouldFetch: true, vendorIds: [...input.savedVendorIds] };
  }
  if (input.urlVendorIds.length > 0) {
    return { shouldFetch: true, vendorIds: input.urlVendorIds };
  }
  return { shouldFetch: true, vendorIds: undefined };
}
