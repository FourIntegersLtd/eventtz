import api from "@/lib/axios";

export type PublicReviewItem = {
  id: string;
  rating: number;
  body: string;
  created_at: string | null;
  reviewer_display: string;
  event_name: string;
  event_date: string;
  booking_total_label: string;
  image_urls?: string[];
};

export type VendorPublicReviewsResponse = {
  success: boolean;
  average_rating: number | null;
  review_count: number;
  reviews: PublicReviewItem[];
};

export async function fetchVendorPublicReviews(
  vendorUserId: string,
): Promise<VendorPublicReviewsResponse> {
  const { data } = await api.get<VendorPublicReviewsResponse>(
    `/api/v1/vendors/${encodeURIComponent(vendorUserId)}/reviews`,
  );
  return data;
}

export type VendorOwnerReviewItem = PublicReviewItem & {
  booking_request_id: string;
};

export type VendorOwnerReviewsResponse = {
  success: boolean;
  average_rating: number | null;
  review_count: number;
  five_star_count?: number;
  reviews: VendorOwnerReviewItem[];
  total?: number;
  offset?: number;
  limit?: number;
};

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
      limit: params.limit ?? 100,
      ...(params.min_rating != null ? { min_rating: params.min_rating } : {}),
    },
  });
  return data;
}

export type ClientOwnerReviewItem = {
  id: string;
  rating: number;
  body: string;
  created_at: string | null;
  booking_request_id: string;
  vendor_user_id: string;
  vendor_display_name: string;
  event_name: string;
  event_date: string;
  image_urls?: string[];
};

export type ClientOwnerReviewsResponse = {
  success: boolean;
  review_count: number;
  reviews: ClientOwnerReviewItem[];
};

export async function fetchClientOwnReviews(): Promise<ClientOwnerReviewsResponse> {
  const { data } = await api.get<ClientOwnerReviewsResponse>("/api/v1/client/reviews");
  return data;
}

export type PostBookingReviewBody = {
  rating: number;
  body: string;
  image_urls?: string[];
};

export type PostedBookingReview = {
  id: string;
  rating: number;
  body: string;
  created_at: string | null;
  image_urls?: string[];
};

export async function postBookingReview(
  bookingId: string,
  body: PostBookingReviewBody,
): Promise<{ success: boolean; review: PostedBookingReview }> {
  const { data } = await api.post(
    `/api/v1/client/booking-requests/${encodeURIComponent(bookingId)}/review`,
    body,
  );
  return data;
}
