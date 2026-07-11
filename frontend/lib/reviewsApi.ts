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

export type PostBookingReviewBody = {
  rating: number;
  body: string;
};

export async function postBookingReview(
  bookingId: string,
  body: PostBookingReviewBody,
): Promise<{ success: boolean; review: { id: string; rating: number; created_at: string | null } }> {
  const { data } = await api.post(
    `/api/v1/client/booking-requests/${encodeURIComponent(bookingId)}/review`,
    body,
  );
  return data;
}
