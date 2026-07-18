"use client";

import { portalCard } from "@/components/portal-shell/portalTheme";
import { LoadingState } from "@/components/ui/LoadingState";
import { ReviewCard } from "@/features/reviews/ReviewCard";
import { ReviewSummaryHeader } from "@/features/reviews/ReviewSummaryHeader";
import { useReviewsQuery } from "@/features/reviews/useReviewsQuery";
import { fetchVendorOwnReviews, type VendorOwnerReviewItem } from "@/lib/reviewsApi";

function VendorReviewRow({ review }: { review: VendorOwnerReviewItem }) {
  const subtitle = `${review.event_name}${review.event_date ? ` · ${review.event_date}` : ""}`;

  return (
    <ReviewCard
      variant="row"
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
            <div className={`px-5 py-10 text-center ${portalCard}`}>
              <p className="font-medium text-neutral-900">No reviews yet</p>
            </div>
          ) : (
            <ul className={`divide-y divide-neutral-100 overflow-hidden ${portalCard}`}>
              {reviews.map((review) => (
                <li key={review.id}>
                  <VendorReviewRow review={review} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
