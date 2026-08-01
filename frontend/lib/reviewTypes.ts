/** Shared review shapes used across client, vendor, and admin UIs. */

export type ReviewCore = {
  id: string;
  rating: number;
  body: string;
  created_at: string | null;
  image_urls?: string[];
};

export type BookingReviewDisplay = ReviewCore & {
  reviewer_display?: string | null;
};
