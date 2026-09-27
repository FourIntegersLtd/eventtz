"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/foundation/ui";
import { parseDeepLinkRating, parseReviewForm, toPostReviewBody } from "@/domains/client-bookings/reviewForm";
import type { PostBookingReviewBody } from "@/domains/client-bookings/api";

const STAR_VALUES = [1, 2, 3, 4, 5] as const;

/**
 * Lets a client review the vendor after a completed booking. The star rating
 * may be pre-seeded from the dashboard's `?rate=N` deep link. Photos are not
 * yet supported in `web/` (no photo picker), so `image_urls` is always empty.
 */
export function ClientReviewForm({ saving, onSubmit }: { saving: boolean; onSubmit: (body: PostBookingReviewBody) => void }) {
  const searchParams = useSearchParams();
  const [rating, setRating] = useState<number>(parseDeepLinkRating(searchParams.get("rate")) ?? 0);
  const [body, setBody] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function submit() {
    const result = parseReviewForm({ rating, body });
    if (!result.ok) {
      setFieldErrors(result.fieldErrors);
      setFormError(result.formError);
      return;
    }
    setFieldErrors({});
    setFormError(null);
    onSubmit(toPostReviewBody(result.data));
  }

  return (
    <form
      className="space-y-3"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <fieldset>
        <legend className="mb-1 block text-sm font-medium text-neutral-700">Your rating</legend>
        <div className="flex gap-1">
          {STAR_VALUES.map((value) => (
            <button
              key={value}
              type="button"
              aria-label={`Rate ${value} star${value === 1 ? "" : "s"}`}
              onClick={() => setRating(value)}
              className={value <= rating ? "text-amber-500" : "text-neutral-300"}
            >
              <span aria-hidden="true" className="text-2xl">
                {value <= rating ? "★" : "☆"}
              </span>
            </button>
          ))}
        </div>
        {fieldErrors.rating ? <span className="mt-1 block text-xs text-red-600">{fieldErrors.rating}</span> : null}
      </fieldset>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-neutral-700">Your review</span>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={4}
          maxLength={4000}
          aria-invalid={Boolean(fieldErrors.body)}
          className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-primary-border border-primary-border"
        />
        {fieldErrors.body ? <span className="mt-1 block text-xs text-red-600">{fieldErrors.body}</span> : null}
      </label>

      {formError ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200/60">{formError}</p>
      ) : null}

      <Button type="submit" loading={saving}>
        Submit review
      </Button>
    </form>
  );
}
