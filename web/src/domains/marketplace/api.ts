/**
 * Marketplace domain API wrappers — typed calls through platformRequest.
 * Every shape is re-exported from the generated schema.d.ts.
 */
import { platformRequest, type components } from "@/foundation/platform-client";

// ---- Types from schema -------------------------------------------------------

export type ExploreVendorSearchRow = components["schemas"]["ExploreVendorSearchRow"];
export type ExploreVendorRow = components["schemas"]["ExploreVendorRow"];
export type ExploreVendorSearchResponse = components["schemas"]["ExploreVendorSearchResponse"];
export type ExploreVendorFeaturedReview = components["schemas"]["ExploreVendorFeaturedReview"];
export type ExploreSearchPlan = components["schemas"]["ExploreSearchPlan"];
export type ExploreSearchSection = components["schemas"]["ExploreSearchSection"];

export type MarketplaceSort =
  | "relevance"
  | "price_asc"
  | "price_desc"
  | "proximity"
  | "rating";

// ---- Explore (browse) --------------------------------------------------------

/** Every listed vendor in one market (unfiltered, for category counts). */
export async function fetchExploreVendors(): Promise<ExploreVendorRow[]> {
  const response = await platformRequest<components["schemas"]["ExploreVendorsResponse"]>(
    "/api/v1/vendors/explore",
  );
  return response.vendors ?? [];
}

/** One listed vendor for a vendor detail page. */
export async function fetchExploreVendorById(
  vendorUserId: string,
): Promise<ExploreVendorRow | null> {
  const response = await platformRequest<components["schemas"]["ExploreVendorSingleResponse"]>(
    `/api/v1/vendors/explore/vendor/${encodeURIComponent(vendorUserId)}`,
  );
  return response.vendor ?? null;
}

/** Search explore vendors — one ranked page. */
export async function fetchExploreVendorsSearch(
  query: {
    q?: string;
    types?: string;
    location?: string;
    dates?: string;
    flexible?: boolean;
    budget_min?: number;
    budget_max?: number;
    sort?: string;
    vendor_ids?: string;
    country?: string;
    limit?: number;
    offset?: number;
  },
): Promise<ExploreVendorSearchResponse> {
  const filtered: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) {
      filtered[key] = value;
    }
  }
  return platformRequest<ExploreVendorSearchResponse>(
    "/api/v1/vendors/explore/search",
    { query: filtered },
  );
}

// ---- Client favorites --------------------------------------------------------

/** The signed-in client's saved vendor user ids. */
export async function fetchClientFavoriteVendorIds(): Promise<string[]> {
  const response = await platformRequest<components["schemas"]["ClientFavoritesListResponse"]>(
    "/api/v1/client/favorites",
  );
  return response.vendor_user_ids ?? [];
}

/** Save a vendor to the client's favorites. */
export async function addClientFavorite(vendorUserId: string): Promise<void> {
  await platformRequest<void>(
    `/api/v1/client/favorites/${encodeURIComponent(vendorUserId)}`,
    { method: "PUT" },
  );
}

/** Remove a vendor from the client's favorites. */
export async function removeClientFavorite(vendorUserId: string): Promise<void> {
  await platformRequest<void>(
    `/api/v1/client/favorites/${encodeURIComponent(vendorUserId)}`,
    { method: "DELETE" },
  );
}

/** Merge guest (unsaved) favorites into the signed-in client's account. */
export async function mergeClientFavorites(vendorUserIds: string[]): Promise<number> {
  const response = await platformRequest<components["schemas"]["ClientFavoritesMergeResponse"]>(
    "/api/v1/client/favorites/merge",
    { method: "POST", body: { vendor_user_ids: vendorUserIds } },
  );
  return response.merged ?? 0;
}

// ---- Vendor profile ----------------------------------------------------------

export type VendorReferralPreviewResponse = components["schemas"]["VendorReferralPreviewResponse"];
export type VendorPublicReviewsResponse = components["schemas"]["VendorPublicReviewsResponse"];
export type PublicReviewItem = components["schemas"]["PublicReviewItem"];

/** What a referral code would take off the service fee for this spend. */
export async function fetchVendorReferralPreview(
  vendorUserId: string,
  code: string,
  vendorPortionGbp: number,
): Promise<VendorReferralPreviewResponse> {
  return platformRequest<VendorReferralPreviewResponse>(
    `/api/v1/vendors/explore/vendor/${encodeURIComponent(vendorUserId)}/referral-preview`,
    { query: { code, vendor_portion_gbp: vendorPortionGbp } },
  );
}

/** A vendor's visible reviews, newest first. */
export async function fetchVendorPublicReviews(
  vendorUserId: string,
): Promise<VendorPublicReviewsResponse> {
  return platformRequest<VendorPublicReviewsResponse>(
    `/api/v1/vendors/${encodeURIComponent(vendorUserId)}/reviews`,
  );
}
