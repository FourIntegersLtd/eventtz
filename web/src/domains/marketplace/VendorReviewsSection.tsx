"use client";

/**
 * Public reviews for one vendor: a one-card carousel, then the full list in a dialog.
 * No carousel package — previous, next, and the dots are plain buttons.
 */
import { useEffect, useState } from "react";
import { fetchVendorPublicReviews, type PublicReviewItem } from "./api";

const PREVIEW_LEN = 220;

type ReviewsResult = {
  key: string;
  reviews: PublicReviewItem[];
  reviewCount: number;
  averageRating: number | null;
  error: string | null;
};

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const days = Math.floor((Date.now() - date.getTime()) / (86400 * 1000));
  if (days < 1) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  return date.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

/** Filled stars up to the rounded rating. */
function StarRating({ rating }: { rating: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span aria-label={`${rating} out of 5`} className="tracking-tight text-amber-500">
      {"★★★★★".slice(0, filled)}
      <span className="text-neutral-300">{"★★★★★".slice(filled)}</span>
    </span>
  );
}

function ReviewCard({
  review,
  expanded,
  onToggleExpand,
}: {
  review: PublicReviewItem;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const long = review.body.length > PREVIEW_LEN;
  const shown = expanded || !long ? review.body : `${review.body.slice(0, PREVIEW_LEN).trim()}…`;
  const photos = review.image_urls ?? [];
  return (
    <div className="px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-neutral-900">{review.reviewer_display}</p>
          <p className="text-xs text-neutral-500">
            {review.event_name}
            {review.event_date ? ` · ${review.event_date}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <StarRating rating={review.rating} />
          <span className="text-sm font-semibold text-neutral-800">{review.rating}</span>
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-neutral-700">{shown}</p>
      {long ? (
        <button
          type="button"
          onClick={onToggleExpand}
          className="mt-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
        >
          {expanded ? "Show less" : "See more"}
        </button>
      ) : null}
      {photos.length > 0 ? (
        <ul className="mt-3 flex gap-2 overflow-x-auto">
          {photos.map((url) => (
            <li key={url} className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-3 text-xs text-neutral-400">{formatRelative(review.created_at)}</p>
    </div>
  );
}

/** Reviews block on the vendor profile. */
export function VendorReviewsSection({ vendorUserId }: { vendorUserId: string }) {
  const [result, setResult] = useState<ReviewsResult | null>(null);
  const [nav, setNav] = useState({ vendorUserId, index: 0 });
  const [modalOpen, setModalOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!vendorUserId) return;
    let cancelled = false;
    fetchVendorPublicReviews(vendorUserId)
      .then((response) => {
        if (cancelled) return;
        setResult({
          key: vendorUserId,
          reviews: response.reviews ?? [],
          reviewCount: response.review_count ?? 0,
          averageRating: response.average_rating ?? null,
          error: null,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setResult({
          key: vendorUserId,
          reviews: [],
          reviewCount: 0,
          averageRating: null,
          error: "Could not load reviews.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [vendorUserId]);

  const loading = result?.key !== vendorUserId;
  const reviews = loading ? [] : (result?.reviews ?? []);
  const count = loading ? 0 : (result?.reviewCount ?? 0);
  const average = loading ? null : (result?.averageRating ?? null);
  const index = nav.vendorUserId === vendorUserId ? nav.index : 0;
  const current = reviews[index];

  const goTo = (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= reviews.length || nextIndex === index) return;
    setNav({ vendorUserId, index: nextIndex });
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-100 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
        <div>
          <h4 className="text-sm font-semibold text-neutral-900">Reviews</h4>
          {count > 0 && average != null ? (
            <p className="mt-0.5 flex items-center gap-2 text-xs text-neutral-600">
              <StarRating rating={Math.round(average)} />
              <span>
                {average.toFixed(1)} · {count} review{count === 1 ? "" : "s"}
              </span>
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-neutral-500">No reviews yet</p>
          )}
        </div>
        {count > 0 ? (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="text-xs font-medium text-primary hover:underline"
          >
            See all reviews
          </button>
        ) : null}
      </div>

      {loading ? (
        <p className="border-t border-neutral-100 px-5 py-4 text-sm text-neutral-500">Loading reviews…</p>
      ) : result?.error ? (
        <p className="border-t border-neutral-100 px-5 py-4 text-xs text-red-700">{result.error}</p>
      ) : count === 0 ? (
        <p className="border-t border-neutral-100 px-5 py-4 text-sm text-neutral-500">
          Verified reviews appear here after clients complete bookings on Eventtz.
        </p>
      ) : current ? (
        <div className="border-t border-neutral-100">
          {reviews.length > 1 ? (
            <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-5 py-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                {reviews.map((review, reviewIndex) => (
                  <button
                    key={review.id}
                    type="button"
                    onClick={() => goTo(reviewIndex)}
                    aria-label={`Go to review ${reviewIndex + 1}`}
                    aria-current={reviewIndex === index ? "true" : undefined}
                    className={`h-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                      reviewIndex === index ? "w-7 bg-neutral-700" : "w-2 bg-neutral-300 hover:bg-neutral-400"
                    }`}
                  />
                ))}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => goTo(index - 1)}
                  disabled={index <= 0}
                  aria-label="Previous review"
                  className="rounded-lg border border-neutral-100 bg-white px-2 py-1 text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => goTo(index + 1)}
                  disabled={index >= reviews.length - 1}
                  aria-label="Next review"
                  className="rounded-lg border border-neutral-100 bg-white px-2 py-1 text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ›
                </button>
              </div>
            </div>
          ) : null}
          <ReviewCard
            review={current}
            expanded={expandedId === current.id}
            onToggleExpand={() => setExpandedId((id) => (id === current.id ? null : current.id))}
          />
          {reviews.length > 1 ? (
            <p className="border-t border-neutral-100 px-5 py-2 text-center text-[11px] text-neutral-400">
              {index + 1} / {reviews.length}
            </p>
          ) : null}
        </div>
      ) : null}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="All reviews"
            className="max-h-[min(80vh,640px)] w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
              <h3 className="text-sm font-semibold text-neutral-900">All reviews</h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
              >
                Close
              </button>
            </div>
            <ul className="max-h-[min(60vh,480px)] divide-y divide-neutral-100 overflow-y-auto">
              {reviews.map((review) => (
                <li key={review.id}>
                  <ReviewCard
                    review={review}
                    expanded={expandedId === review.id}
                    onToggleExpand={() => setExpandedId((id) => (id === review.id ? null : review.id))}
                  />
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </section>
  );
}
