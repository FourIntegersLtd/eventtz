"use client";

import { LoadingState } from "@/components/ui/LoadingState";
import { ReviewCard } from "@/features/reviews/ReviewCard";
import { useReviewsQuery } from "@/features/reviews/useReviewsQuery";
import { fetchClientOwnReviews, type ClientOwnerReviewItem } from "@/lib/reviewsApi";

function ClientReviewRow({ review }: { review: ClientOwnerReviewItem }) {
  const subtitle = `${review.event_name}${review.event_date ? ` · ${review.event_date}` : ""}`;

  return (
    <ReviewCard
      title={review.vendor_display_name}
      titleHref={`/client/browse/${review.vendor_user_id}`}
      subtitle={subtitle}
      rating={review.rating}
      body={review.body}
      createdAt={review.created_at}
      bookingHref={`/client/bookings/${review.booking_request_id}`}
      compact
    />
  );
}

type ClientOwnReviewsSectionProps = {
  /** When false, omit the outer card shell (for dedicated page layout). */
  showShell?: boolean;
};

export function ClientOwnReviewsSection({ showShell = true }: ClientOwnReviewsSectionProps) {
  const { data, loading, error } = useReviewsQuery(fetchClientOwnReviews, "Could not load your reviews.");
  const reviews = data?.reviews ?? [];

  const content = (
    <>
      {showShell ? (
        <h2 className="font-heading text-lg font-semibold text-neutral-900">Your reviews</h2>
      ) : null}

      {loading ? (
        <LoadingState label="Loading reviews…" variant="inline" className={showShell ? "mt-4" : ""} />
      ) : error ? (
        <p
          className={`rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200/50 ${showShell ? "mt-4" : ""}`}
        >
          {error}
        </p>
      ) : reviews.length === 0 ? (
        <p className={showShell ? "mt-3 text-sm text-neutral-600" : "text-sm text-neutral-600"}>
          You haven't left any reviews yet.
        </p>
      ) : (
        <div className={showShell ? "mt-4 space-y-3" : "space-y-3"}>
          {reviews.map((review) => (
            <ClientReviewRow key={review.id} review={review} />
          ))}
        </div>
      )}
    </>
  );

  if (!showShell) return content;

  return (
    <section className="rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm sm:p-6">
      {content}
    </section>
  );
}
