"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { platformErrorDetail } from "@/foundation/platform-client";
import { Card, Spinner } from "@/foundation/ui";
import { fetchOwnReviews, type VendorOwnerReviewItem, type VendorOwnerReviewsResponse } from "@/domains/vendor-profile/api";

/** One review row: reviewer, event, star rating, and the review body. */
function ReviewRow({ review }: { review: VendorOwnerReviewItem }) {
  const subtitle = [review.event_name, review.event_date].filter(Boolean).join(" · ");
  return (
    <li className="space-y-1 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium text-neutral-900">{review.reviewer_display}</p>
        <span className="shrink-0 text-sm font-semibold text-amber-600">{"★".repeat(review.rating)}</span>
      </div>
      <p className="text-xs text-neutral-500">{subtitle}</p>
      <p className="text-sm text-neutral-700">{review.body}</p>
    </li>
  );
}

/** Average rating and count, above the review list. */
function ReviewSummary({ response }: { response: VendorOwnerReviewsResponse }) {
  const average = response.average_rating;
  return (
    <p className="text-sm text-neutral-600">
      {average != null ? `${average.toFixed(1)} average · ` : ""}
      {response.review_count} review{response.review_count === 1 ? "" : "s"}
    </p>
  );
}

/**
 * `/vendor/profile/reviews` — the vendor's own client reviews.
 * Ported from the baseline's `VendorProfileReviewsPanel`.
 */
export function ReviewsView() {
  const [data, setData] = useState<VendorOwnerReviewsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchOwnReviews();
        if (!cancelled) setData(result);
      } catch (cause: unknown) {
        if (!cancelled) setError(platformErrorDetail(cause) ?? "Could not load your reviews.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="w-full max-w-3xl space-y-6">
      <Link href="/vendor/profile" className="text-sm font-medium text-primary hover:underline">
        ← Profile
      </Link>
      <h1 className="font-heading text-2xl font-semibold text-neutral-900">Client reviews</h1>

      {loading ? <Spinner label="Loading reviews…" /> : null}
      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200/50">{error}</p> : null}

      {data ? (
        <>
          <ReviewSummary response={data} />
          <Card>
            {data.reviews && data.reviews.length > 0 ? (
              <ul className="divide-y divide-neutral-100">
                {data.reviews.map((review) => (
                  <ReviewRow key={review.id} review={review} />
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-neutral-500">No reviews yet.</p>
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}
