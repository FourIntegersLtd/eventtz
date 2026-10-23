"use client";

import Link from "next/link";
import { Star } from "lucide-react";
import { useCallback, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { LottieFailureInline } from "@/components/ui/LottieFailureInline";
import { LoadingState } from "@/components/ui/LoadingState";
import { useReviewsQuery } from "@/features/reviews/useReviewsQuery";
import { fetchVendorOwnReviews, type VendorOwnerReviewItem } from "@/lib/reviewsApi";
import { formatDate } from "@/lib/dateFormat";

function stars(rating: number) {
  return Array.from({ length: 5 }, (_, index) => (
    <Star
      key={index}
      size={15}
      strokeWidth={1.75}
      aria-hidden
      fill={index < rating ? "currentColor" : "none"}
    />
  ));
}

function whenLabel(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return formatDate(date, "dayMonthYear");
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

type VendorReviewsEzViewProps = {
  /** Inside the profile tabs the page head stays on the profile. */
  embedded?: boolean;
};

/** Vendor reviews (design V27). There is no reply API, so the list is read-only. */
export function VendorReviewsEzView({ embedded = false }: VendorReviewsEzViewProps) {
  const [fiveOnly, setFiveOnly] = useState(false);
  const fetcher = useCallback(
    () => fetchVendorOwnReviews(fiveOnly ? { min_rating: 5, limit: 100 } : { limit: 100 }),
    [fiveOnly],
  );
  const { data, loading, error } = useReviewsQuery(fetcher, "Could not load your reviews.");
  const reviews = data?.reviews ?? [];
  const fiveCount = data?.five_star_count ?? 0;
  const average = data?.average_rating;

  return (
    <div className="ez-stack ez-stack--lg">
      {embedded ? null : (
        <PageHeader descriptionSize="body"
          eyebrow="Business"
          title="Reviews"
          description="What clients say about your business."
        />
      )}

      <div className="ez-grid-4">
        <div className="ez-kpi">
          <span className="ez-kpi__label">
            <Star size={16} strokeWidth={1.75} aria-hidden />
            Average rating
          </span>
          <span className="ez-kpi__value">{average == null ? "-" : average.toFixed(1)}</span>
          <span className="ez-kpi__delta">from {data?.review_count ?? 0} reviews</span>
        </div>
        <div className="ez-kpi">
          <span className="ez-kpi__label">5 stars</span>
          <span className="ez-kpi__value">{fiveCount}</span>
        </div>
        <div className="ez-kpi">
          <span className="ez-kpi__label">Reviews</span>
          <span className="ez-kpi__value">{data?.review_count ?? 0}</span>
        </div>
        <div className="ez-kpi">
          <span className="ez-kpi__label">With photos</span>
          <span className="ez-kpi__value">{reviews.filter((review) => (review.image_urls?.length ?? 0) > 0).length}</span>
        </div>
      </div>

      <div className="ez-card">
        <div className="ez-card__head">
          <span className="ez-h3">Recent reviews</span>
          <div className="ez-tabs" role="tablist">
            <button type="button" className={`ez-tab${!fiveOnly ? " ez-tab--active" : ""}`} onClick={() => setFiveOnly(false)}>
              All<span className="ez-tab__count">{data?.review_count ?? 0}</span>
            </button>
            <button type="button" className={`ez-tab${fiveOnly ? " ez-tab--active" : ""}`} onClick={() => setFiveOnly(true)}>
              5 stars<span className="ez-tab__count">{fiveCount}</span>
            </button>
          </div>
        </div>
        <div className="ez-card__body">
          {loading ? (
            <LoadingState label="Loading reviews…" variant="inline" />
          ) : error ? (
            <LottieFailureInline message={error} />
          ) : reviews.length === 0 ? (
            <EmptyState
              className="border-0"
              lottie={fiveOnly ? "searchNoResults" : "reviews"}
              title={fiveOnly ? "No 5-star reviews" : "No reviews yet"}
            />
          ) : (
            reviews.map((review) => <ReviewRow key={review.id} review={review} />)
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewRow({ review }: { review: VendorOwnerReviewItem }) {
  return (
    <div className="ez-list-row" style={{ alignItems: "flex-start" }}>
      <span className="ez-avatar">{initials(review.reviewer_display)}</span>
      <div className="ez-list-row__main">
        <div className="ez-hrow">
          <span className="ez-strong">{review.reviewer_display}</span>
          <span className="ez-stars" aria-label={`${review.rating} stars`}>
            {stars(review.rating)}
          </span>
          <span className="ez-caption">{whenLabel(review.created_at)}</span>
        </div>
        <p className="ez-body">{review.body}</p>
        <span className="ez-small">
          {review.event_name}
          {review.booking_request_id ? (
            <>
              {" · "}
              <Link href={`/vendor/bookings/${review.booking_request_id}`}>View booking</Link>
            </>
          ) : null}
        </span>
      </div>
    </div>
  );
}
