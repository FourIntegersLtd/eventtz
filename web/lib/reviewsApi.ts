import type { components } from "@/lib/api-schema";
import api from "@/lib/axios";
import { DEFAULT_LIST_PAGE_SIZE } from "@/lib/listPageSize";

export type PublicReviewItem = components["schemas"]["PublicReviewItem"];

export type VendorPublicReviewsResponse = components["schemas"]["VendorPublicReviewsResponse"];

export async function fetchVendorPublicReviews(
  vendorUserId: string,
): Promise<VendorPublicReviewsResponse> {
  const { data } = await api.get<VendorPublicReviewsResponse>(
    `/api/v1/vendors/${encodeURIComponent(vendorUserId)}/reviews`,
  );
  return data;
}

export type VendorOwnerReviewItem = components["schemas"]["VendorOwnerReviewItem"];

export type VendorOwnerReviewsResponse = components["schemas"]["VendorOwnerReviewsResponse"];

export type VendorOwnReviewsParams = {
  min_rating?: number;
  offset?: number;
  limit?: number;
};

export async function fetchVendorOwnReviews(
  params: VendorOwnReviewsParams = {},
): Promise<VendorOwnerReviewsResponse> {
  const { data } = await api.get<VendorOwnerReviewsResponse>("/api/v1/vendor/reviews", {
    params: {
      offset: params.offset ?? 0,
      limit: params.limit ?? DEFAULT_LIST_PAGE_SIZE,
      ...(params.min_rating != null ? { min_rating: params.min_rating } : {}),
    },
  });
  return data;
}

export type ClientOwnerReviewItem = components["schemas"]["ClientOwnerReviewItem"];

export type ClientOwnerReviewsResponse = components["schemas"]["ClientOwnerReviewsResponse"];

export async function fetchClientOwnReviews(): Promise<ClientOwnerReviewsResponse> {
  const { data } = await api.get<ClientOwnerReviewsResponse>("/api/v1/client/reviews");
  return data;
}

export type PostBookingReviewBody = components["schemas"]["PostBookingReviewBody"];

export type PostedBookingReview = components["schemas"]["SubmittedReview"];

export async function postBookingReview(
  bookingId: string,
  body: PostBookingReviewBody,
): Promise<components["schemas"]["PostBookingReviewResponse"]> {
  const { data } = await api.post<components["schemas"]["PostBookingReviewResponse"]>(
    `/api/v1/client/booking-requests/${encodeURIComponent(bookingId)}/review`,
    body,
  );
  return data;
}
