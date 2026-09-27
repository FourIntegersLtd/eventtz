"use client";

import { Card } from "@/foundation/ui";
import { formatDateTime } from "@/domains/client-bookings/format";
import type { ClientReviewSummary } from "@/domains/client-bookings/api";

/** The review this client already left on a completed booking, shown read-only. */
export function ReviewSummaryCard({ review }: { review: ClientReviewSummary }) {
  return (
    <Card>
      <h3 className="font-semibold text-neutral-900">Your review</h3>
      <div className="mt-2 space-y-2">
        <p className="text-sm text-neutral-600">
          <span aria-hidden="true" className="text-amber-500">
            {"★".repeat(review.rating) + "☆".repeat(Math.max(0, 5 - review.rating))}
          </span>
          <span className="sr-only">{review.rating} out of 5</span>
        </p>
        <p className="whitespace-pre-wrap text-sm text-neutral-700">{review.body}</p>
        {review.created_at ? <p className="text-xs text-neutral-500">{formatDateTime(review.created_at)}</p> : null}
      </div>
    </Card>
  );
}
