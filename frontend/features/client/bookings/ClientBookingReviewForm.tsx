"use client";

import { useEffect, useRef, useState } from "react";
import { postBookingReview } from "@/lib/reviewsApi";
import { getApiErrorDetail } from "@/lib/api-errors";
import { StarRating } from "@/components/ui/StarRating";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/TextArea";

type ClientBookingReviewFormProps = {
  bookingId: string;
  vendorName: string;
  /** Pre-selects a star rating (e.g. arriving from the dashboard nudge) and auto-focuses the write-up. */
  initialRating?: number;
  onSubmitted: (review: { id: string; rating: number; created_at: string | null }) => void;
};

/**
 * One-tap nudge: tapping a star sets the rating and reveals the (required)
 * write-up immediately, auto-focused — the client never has to hunt for a
 * separate "leave a review" action after a booking completes.
 */
export function ClientBookingReviewForm({
  bookingId,
  vendorName,
  initialRating = 0,
  onSubmitted,
}: ClientBookingReviewFormProps) {
  const [rating, setRating] = useState(initialRating);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (initialRating > 0) {
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
    // Only meant to run once on mount for the initial deep-link rating.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    setError(null);
    const t = body.trim();
    if (rating < 1) {
      setError("Tap a star to rate your experience.");
      return;
    }
    if (t.length < 10) {
      setError("Please write at least 10 characters.");
      return;
    }
    setBusy(true);
    try {
      const res = await postBookingReview(bookingId, { rating, body: t });
      onSubmitted(res.review);
      setBody("");
    } catch (e: unknown) {
      setError(getApiErrorDetail(e) ?? "Could not submit your review.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-primary/25 bg-primary/[0.06] px-4 py-4">
      <p className="text-sm font-semibold text-neutral-900">
        How was your experience with {vendorName}?
      </p>
      <p className="mt-1 text-xs text-neutral-600">
        Tap a star to get started — your review helps other clients choose vendors on Eventtz.
      </p>
      <div className="mt-3">
        <StarRating
          rating={rating}
          size="lg"
          onRate={(value) => {
            setRating(value);
            setError(null);
            requestAnimationFrame(() => textareaRef.current?.focus());
          }}
        />
      </div>
      {rating > 0 ? (
        <div className="mt-3 animate-ui-fade-in space-y-3">
          <TextArea
            ref={textareaRef}
            label="Your review"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            maxLength={4000}
            placeholder="Share what went well (minimum 10 characters)."
          />
          {error ? <p className="text-xs text-red-700">{error}</p> : null}
          <Button variant="primary" loading={busy} onClick={() => void submit()}>
            Submit review
          </Button>
        </div>
      ) : error ? (
        <p className="mt-2 text-xs text-red-700">{error}</p>
      ) : null}
    </div>
  );
}
