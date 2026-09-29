import { platformRequest, type components } from "@/foundation/platform-client";

/** Reviews left for the signed-in vendor. */
export type VendorOwnerReviewsResponse = components["schemas"]["VendorOwnerReviewsResponse"];
/** One of those reviews. */
export type VendorOwnerReviewItem = components["schemas"]["VendorOwnerReviewItem"];

/** Fetch every visible review left for the signed-in vendor, newest first. */
export function fetchOwnReviews(): Promise<VendorOwnerReviewsResponse> {
  return platformRequest<VendorOwnerReviewsResponse>("/api/v1/vendor/reviews");
}
