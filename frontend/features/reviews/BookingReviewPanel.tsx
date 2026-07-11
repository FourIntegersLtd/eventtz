import { StarRating } from "@/components/ui/StarRating";
import { formatReviewWhen } from "./reviewFormatters";
import { ReviewBodyText } from "./ReviewBodyText";
import type { BookingReviewDisplay } from "@/lib/reviewTypes";

type BookingReviewPanelProps = {
  title: string;
  review: BookingReviewDisplay | null | undefined;
  emptyLabel?: string;
  showReviewer?: boolean;
  variant?: "default" | "amber";
};

export function BookingReviewPanel({
  title,
  review,
  emptyLabel = "No review yet.",
  showReviewer = false,
  variant = "default",
}: BookingReviewPanelProps) {
  const shellClass =
    variant === "amber"
      ? "rounded-xl border border-amber-200/80 bg-gradient-to-b from-amber-50/80 to-white px-4 py-3"
      : "rounded-xl border border-neutral-200 bg-white px-4 py-3";

  return (
    <section className={shellClass}>
      <h3 className="font-heading text-sm font-semibold text-neutral-900">{title}</h3>
      {review ? (
        <div className="mt-2">
          <div className="flex flex-wrap items-center gap-2">
            <StarRating rating={review.rating} size="md" />
            <span className="text-sm font-semibold text-neutral-900">{review.rating}/5</span>
            {showReviewer && review.reviewer_display ? (
              <span className="text-xs text-neutral-500">{review.reviewer_display}</span>
            ) : null}
            {review.created_at ? (
              <span className="text-xs text-neutral-500">{formatReviewWhen(review.created_at)}</span>
            ) : null}
          </div>
          <div className="mt-3">
            <ReviewBodyText body={review.body} previewLen={9999} />
          </div>
        </div>
      ) : (
        <p className="mt-2 text-xs text-neutral-500">{emptyLabel}</p>
      )}
    </section>
  );
}
