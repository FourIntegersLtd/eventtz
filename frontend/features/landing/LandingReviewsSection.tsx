"use client";

import { useEffect, useState } from "react";
import { fetchExploreVendorsSearch } from "@/lib/clientExploreApi";
import { fetchVendorPublicReviews, type PublicReviewItem } from "@/lib/reviewsApi";
import { StarRating } from "@/components/ui/StarRating";
import { LandingSectionHeading } from "@/features/landing/LandingSectionHeading";
import { LandingSection } from "@/features/landing/LandingSection";

const MAX_REVIEWS = 3;
const PREVIEW_LEN = 180;

type LandingReview = PublicReviewItem & {
  vendorName: string;
};

function trimBody(body: string): string {
  const trimmed = body.trim();
  if (trimmed.length <= PREVIEW_LEN) return trimmed;
  return `${trimmed.slice(0, PREVIEW_LEN).trim()}…`;
}

export function LandingReviewsSection() {
  const [reviews, setReviews] = useState<LandingReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const { vendors } = await fetchExploreVendorsSearch({ sort: "rating" });
        const withReviews = vendors
          .filter((v) => (v.review_count ?? 0) > 0)
          .slice(0, 6);

        const collected: LandingReview[] = [];
        const seenReviewIds = new Set<string>();

        for (const vendor of withReviews) {
          if (collected.length >= MAX_REVIEWS) break;
          try {
            const res = await fetchVendorPublicReviews(vendor.user_id);
            const payload = vendor.payload ?? {};
            const vendorName =
              (typeof payload.businessName === "string" && payload.businessName.trim()) ||
              "Event vendor";

            for (const review of res.reviews) {
              if (collected.length >= MAX_REVIEWS) break;
              if (!review.body.trim() || seenReviewIds.has(review.id)) continue;
              seenReviewIds.add(review.id);
              collected.push({ ...review, vendorName });
            }
          } catch {
            // Skip vendors whose reviews fail to load.
          }
        }

        if (!cancelled) setReviews(collected);
      } catch {
        if (!cancelled) setReviews([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!loading && reviews.length === 0) {
    return null;
  }

  return (
    <LandingSection
      id="reviews"
      className="border-t border-primary-border/50 bg-white py-16 sm:py-20 md:py-24"
      width="6xl"
    >
      <LandingSectionHeading
        eyebrow="Reviews"
        title="What clients are saying"
        description="A few words from people who booked through Eventtz."
      />

      {loading ? (
        <div className="mt-10 grid gap-5 sm:mt-12 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-2xl bg-primary-muted"
              aria-hidden
            />
          ))}
        </div>
      ) : (
        <div className="mt-10 grid gap-5 sm:mt-12 sm:grid-cols-3">
          {reviews.map((review) => (
            <article
              key={review.id}
              className="flex flex-col rounded-2xl border border-primary-border bg-primary-soft/20 p-6"
            >
              <div className="flex items-center gap-2">
                <StarRating rating={review.rating} size="md" />
                <span className="text-sm font-semibold text-neutral-800">{review.rating}/5</span>
              </div>
              <p className="mt-4 flex-1 text-sm leading-relaxed text-neutral-700 sm:text-[15px] sm:leading-7">
                &ldquo;{trimBody(review.body)}&rdquo;
              </p>
              <div className="mt-5 border-t border-primary-border/60 pt-4">
                <p className="text-sm font-medium text-neutral-900">{review.reviewer_display}</p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {review.event_name}
                  {review.vendorName ? ` · ${review.vendorName}` : ""}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </LandingSection>
  );
}
