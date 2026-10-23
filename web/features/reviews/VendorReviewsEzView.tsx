"use client";

import Link from "next/link";
import { Star } from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatTile } from "@/components/ui/StatTile";
import { TablePagination } from "@/components/ui/TablePagination";
import { Tabs } from "@/components/ui/Tabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { LottieFailureInline } from "@/components/ui/LottieFailureInline";
import { LoadingState } from "@/components/ui/LoadingState";
import { useServerList } from "@/lib/useServerList";
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

/** Whole-business figures the reviews endpoint returns beside each page of rows. */
type ReviewTotals = { reviewCount: number; fiveStarCount: number; average: number | null };

/** Vendor reviews (design V27). There is no reply API, so the list is read-only. */
export function VendorReviewsEzView({ embedded = false }: VendorReviewsEzViewProps) {
  const [fiveOnly, setFiveOnly] = useState(false);
  const [totals, setTotals] = useState<ReviewTotals>({ reviewCount: 0, fiveStarCount: 0, average: null });

  const {
    items: reviews,
    total,
    offset,
    limit,
    loading,
    error,
    goNext,
    goPrevious,
  } = useServerList<VendorOwnerReviewItem, { fiveOnly: boolean }>({
    filters: { fiveOnly },
    errorMessage: "Could not load your reviews.",
    fetchPage: async ({ offset: pageOffset, limit: pageLimit, filters }) => {
      const page = await fetchVendorOwnReviews({
        offset: pageOffset,
        limit: pageLimit,
        ...(filters.fiveOnly ? { min_rating: 5 } : {}),
      });
      setTotals({
        reviewCount: page.review_count ?? 0,
        fiveStarCount: page.five_star_count ?? 0,
        average: page.average_rating ?? null,
      });
      return { items: page.reviews ?? [], total: page.total ?? 0 };
    },
  });

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
        <StatTile
          icon={Star}
          label="Average rating"
          value={totals.average == null ? "-" : totals.average.toFixed(1)}
          delta={`from ${totals.reviewCount} reviews`}
        />
        <StatTile label="5 stars" value={totals.fiveStarCount} />
        <StatTile label="Reviews" value={totals.reviewCount} />
        <StatTile
          label="With photos"
          value={reviews.filter((review) => (review.image_urls?.length ?? 0) > 0).length}
          hint="on this page"
        />
      </div>

      <Card>
        <Card.Header>
          <span className="ez-h3">Recent reviews</span>
          <Tabs
            aria-label="Review filter"
            value={fiveOnly ? "five" : "all"}
            onChange={(value) => setFiveOnly(value === "five")}
            options={[
              { value: "all", label: "All", count: totals.reviewCount },
              { value: "five", label: "5 stars", count: totals.fiveStarCount },
            ]}
          />
        </Card.Header>
        <Card.Body>
          {loading && reviews.length === 0 ? (
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
        </Card.Body>
      </Card>

      {total > 0 ? (
        <TablePagination
          offset={offset}
          limit={limit}
          total={total}
          pageRowCount={reviews.length}
          loading={loading}
          onPrevious={goPrevious}
          onNext={goNext}
        />
      ) : null}
    </div>
  );
}

function ReviewRow({ review }: { review: VendorOwnerReviewItem }) {
  return (
    <div className="ez-list-row !items-start">
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
