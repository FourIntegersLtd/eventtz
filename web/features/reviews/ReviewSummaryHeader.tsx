import { StarRating } from "@/components/ui/StarRating";

type ReviewSummaryHeaderProps = {
  averageRating: number | null | undefined;
  reviewCount: number;
  emptyLabel?: string;
  className?: string;
};

export function ReviewSummaryHeader({
  averageRating,
  reviewCount,
  emptyLabel = "No reviews yet",
  className = "rounded-xl border border-line bg-white p-4",
}: ReviewSummaryHeaderProps) {
  if (averageRating == null || reviewCount === 0) {
    return (
      <div className={className}>
        <p className="text-sm text-ink-2">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <StarRating rating={Math.round(averageRating)} size="md" />
        <span className="text-lg font-semibold text-ink">{averageRating.toFixed(1)}</span>
        <span className="text-sm text-ink-3">
          · {reviewCount} review{reviewCount === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
}
