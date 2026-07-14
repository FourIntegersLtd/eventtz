"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { LoadingState } from "@/components/ui/LoadingState";
import {
  fetchVendorPublicReviews,
  type PublicReviewItem,
  type VendorPublicReviewsResponse,
} from "@/lib/reviewsApi";
import { StarRating } from "@/components/ui/StarRating";

const PREVIEW_LEN = 220;

function formatRelative(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / (86400 * 1000));
  if (days < 1) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

function ReviewCard({
  r,
  expanded,
  onToggleExpand,
}: {
  r: PublicReviewItem;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const long = r.body.length > PREVIEW_LEN;
  const shown = expanded || !long ? r.body : `${r.body.slice(0, PREVIEW_LEN).trim()}…`;
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-neutral-900">{r.reviewer_display}</p>
          <p className="text-xs text-neutral-500">
            {r.event_name}
            {r.event_date ? ` · ${r.event_date}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <StarRating rating={r.rating} size="md" />
          <span className="text-sm font-semibold text-neutral-800">{r.rating}</span>
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
      <p className="mt-3 text-xs text-neutral-400">{formatRelative(r.created_at)}</p>
    </div>
  );
}

type VendorReviewsSectionProps = {
  vendorUserId: string;
};

export function VendorReviewsSection({ vendorUserId }: VendorReviewsSectionProps) {
  const [data, setData] = useState<VendorPublicReviewsResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [slideDir, setSlideDir] = useState<"next" | "prev">("next");
  const [modalOpen, setModalOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const hasNavigated = useRef(false);

  const load = useCallback(async () => {
    if (!vendorUserId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetchVendorPublicReviews(vendorUserId);
      setData(res);
      setIndex(0);
      hasNavigated.current = false;
    } catch {
      setLoadError("Could not load reviews.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [vendorUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const reviews = data?.reviews ?? [];
  const count = data?.review_count ?? 0;
  const avg = data?.average_rating;
  const current = reviews[index];
  const canPrev = index > 0;
  const canNext = index < reviews.length - 1;

  const goPrev = () => {
    const next = Math.max(0, index - 1);
    if (next === index) return;
    hasNavigated.current = true;
    setSlideDir("prev");
    setIndex(next);
  };

  const goNext = () => {
    const next = Math.min(reviews.length - 1, index + 1);
    if (next === index) return;
    hasNavigated.current = true;
    setSlideDir("next");
    setIndex(next);
  };

  const goToIndex = (i: number) => {
    if (i === index || i < 0 || i >= reviews.length) return;
    hasNavigated.current = true;
    setSlideDir(i > index ? "next" : "prev");
    setIndex(i);
  };

  return (
    <section className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50/80 px-4 py-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="font-heading text-sm font-semibold text-neutral-900">Reviews</h4>
          {count > 0 && avg != null ? (
            <p className="mt-0.5 flex items-center gap-2 text-xs text-neutral-600">
              <StarRating rating={Math.round(avg)} size="md" />
              <span>
                {avg.toFixed(1)} · {count} review{count === 1 ? "" : "s"}
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
        <LoadingState label="Loading reviews…" variant="inline" className="mt-3" />
      ) : loadError ? (
        <p className="mt-3 text-xs text-red-700">{loadError}</p>
      ) : count === 0 ? (
        <p className="mt-3 text-xs text-neutral-500">
          Verified reviews appear here after clients complete bookings on Eventtz.
        </p>
      ) : current ? (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            {reviews.length > 1 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {reviews.map((r, i) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => goToIndex(i)}
                    aria-label={`Go to review ${i + 1}`}
                    aria-current={i === index ? "true" : undefined}
                    className={`h-2 rounded-full transition-all duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 ${
                      i === index
                        ? "w-7 bg-neutral-700"
                        : "w-2 bg-neutral-300 hover:bg-neutral-400"
                    }`}
                  />
                ))}
              </div>
            ) : (
              <span />
            )}
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={goPrev}
                disabled={!canPrev}
                className="rounded-full border border-neutral-200 bg-white p-2 text-neutral-700 shadow-sm transition hover:-translate-x-px hover:bg-neutral-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Previous review"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={!canNext}
                className="rounded-full border border-neutral-200 bg-white p-2 text-neutral-700 shadow-sm transition hover:translate-x-px hover:bg-neutral-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Next review"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="relative overflow-hidden">
            <div
              key={current.id}
              className={
                hasNavigated.current
                  ? slideDir === "next"
                    ? "animate-review-enter-next"
                    : "animate-review-enter-prev"
                  : undefined
              }
            >
              <ReviewCard
                r={current}
                expanded={expandedId === current.id}
                onToggleExpand={() =>
                  setExpandedId((id) => (id === current.id ? null : current.id))
                }
              />
            </div>
          </div>
          {reviews.length > 1 ? (
            <p className="mt-2 text-center text-[11px] text-neutral-400">
              {index + 1} / {reviews.length}
            </p>
          ) : null}
        </div>
      ) : null}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="All reviews"
        maxWidthClassName="max-w-lg"
      >
        <ul className="max-h-[min(60vh,480px)] space-y-4 overflow-y-auto pr-1">
          {reviews.map((r) => (
            <li key={r.id}>
              <ReviewCard
                r={r}
                expanded={expandedId === r.id}
                onToggleExpand={() =>
                  setExpandedId((id) => (id === r.id ? null : r.id))
                }
              />
            </li>
          ))}
        </ul>
      </Modal>
    </section>
  );
}
