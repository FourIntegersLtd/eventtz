"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { platformErrorDetail } from "@/foundation/platform-client";
import { Card, LoadingState } from "@/foundation/ui";
import { fetchClientOwnReviews, type ClientOwnerReviewItem } from "@/domains/client-reviews/api";
import { formatReviewSubtitle, formatReviewTimestamp, starRating } from "@/domains/client-reviews/reviewFormatting";

/** One of the client's reviews: the vendor, event, rating, body, photos and a booking link. */
function ClientReviewRow({ review }: { review: ClientOwnerReviewItem }) {
  return (
    <li className="space-y-1 py-4">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/client/browse/${review.vendor_user_id}`}
          className="font-medium text-primary hover:underline"
        >
          {review.vendor_display_name}
        </Link>
        <span className="shrink-0 text-sm font-semibold text-amber-600">{starRating(review.rating)}</span>
      </div>
      <p className="text-xs text-neutral-500">{formatReviewSubtitle(review.event_name, review.event_date)}</p>
      <p className="text-sm text-neutral-700">{review.body}</p>

      {review.image_urls && review.image_urls.length > 0 ? (
        <div className="flex flex-wrap gap-2 pt-1">
          {review.image_urls
            .filter((url) => Boolean(url))
            .map((url, index) => (
              // eslint-disable-next-line @next/next/no-img-element -- review photos are remote, unprefixed URLs.
              <img
                key={`${url}-${index}`}
                src={url}
                alt={`Review photo ${index + 1}`}
                loading="lazy"
                decoding="async"
                className="h-20 w-20 rounded-md object-cover"
              />
            ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs text-neutral-500">
        {review.created_at ? <span>{formatReviewTimestamp(review.created_at)}</span> : null}
        <Link href={`/client/bookings/${review.booking_request_id}`} className="font-medium text-primary hover:underline">
          View booking
        </Link>
      </div>
    </li>
  );
}

/**
 * `/client/settings/reviews` — every review the client has written, newest
 * first. Ported from the baseline's `ClientOwnReviewsSection` (the `showShell`
 * dedicated-page variant, which omits the outer section heading/card chrome).
 */
export function ClientOwnReviewsView() {
  const [reviews, setReviews] = useState<ClientOwnerReviewItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchClientOwnReviews();
        if (!cancelled) setReviews(result);
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
      <Link href="/client/settings" className="text-sm font-medium text-primary hover:underline">
        ← Settings
      </Link>
      <header>
        <h1 className="font-heading text-xl font-semibold text-neutral-900">Your reviews</h1>
        <p className="mt-1 text-sm text-neutral-600">Reviews from completed bookings.</p>
      </header>

      {loading ? <LoadingState variant="inline" label="Loading reviews…" /> : null}
      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200/50">{error}</p> : null}

      {reviews ? (
        reviews.length === 0 ? (
          <p className="text-sm text-neutral-600">You haven&apos;t left any reviews yet.</p>
        ) : (
          <Card padding="lg">
            <ul className="divide-y divide-neutral-100">
              {reviews.map((review) => (
                <ClientReviewRow key={review.id} review={review} />
              ))}
            </ul>
          </Card>
        )
      ) : null}
    </div>
  );
}
