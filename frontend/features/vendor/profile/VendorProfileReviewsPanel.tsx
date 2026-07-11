"use client";

import { LoadingState } from "@/components/ui/LoadingState";
import { ReviewCard } from "@/features/reviews/ReviewCard";
import { ReviewSummaryHeader } from "@/features/reviews/ReviewSummaryHeader";
import { useReviewsQuery } from "@/features/reviews/useReviewsQuery";
import { fetchVendorOwnReviews, type VendorOwnerReviewItem } from "@/lib/reviewsApi";

function VendorReviewRow({ review }: { review: VendorOwnerReviewItem }) {
  const subtitle = `${review.event_name}${review.event_date ? ` · ${review.event_date}` : ""}`;

  return (
    <ReviewCard
      title={review.reviewer_display}
      subtitle={subtitle}
      rating={review.rating}
      body={review.body}
      createdAt={review.created_at}
      bookingHref={
        review.booking_request_id ? `/vendor/bookings/${review.booking_request_id}` : null
      }
    />
  );
}

export function VendorProfileReviewsPanel() {
  const { data, loading, error } = useReviewsQuery(fetchVendorOwnReviews, "Could not load your reviews.");
  const reviews = data?.reviews ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-semibold text-neutral-900">Client reviews</h2>
      </div>

      {loading ? (
        <LoadingState label="Loading reviews…" variant="inline" />
      ) : error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200/50">
          {error}
        </p>
      ) : (
        <>
          <ReviewSummaryHeader
            averageRating={data?.average_rating}
            reviewCount={data?.review_count ?? 0}
          />

          {reviews.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50/60 px-5 py-10 text-center">
              <p className="font-medium text-neutral-900">No reviews yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <VendorReviewRow key={review.id} review={review} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
