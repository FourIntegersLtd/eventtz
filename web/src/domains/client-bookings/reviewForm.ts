/**
 * Validation and request-body building for the booking-detail review form,
 * ported from the baseline's `lib/validation/bookings.ts` `reviewSchema` and
 * `lib/reviewsApi.ts` `postBookingReview`.
 */
import { z } from "zod";
import { parseForm, type ParseOk, type ParseFail } from "@/domains/client-bookings/parseForm";
import type { PostBookingReviewBody } from "@/domains/client-bookings/api";

export const reviewSchema = z.object({
  rating: z.number().int().min(1, "Tap a star to rate your experience.").max(5),
  body: z.string().trim().min(10, "Please enter at least 10 characters.").max(4000, "Review is too long."),
  image_urls: z.array(z.string().url()).max(5, "You can attach up to 5 photos.").optional().default([]),
});

export type ReviewFormInput = z.infer<typeof reviewSchema>;

/** Validates the review form; a failure carries per-field errors plus a single banner message. */
export function parseReviewForm(input: unknown): ParseOk<ReviewFormInput> | ParseFail {
  return parseForm(reviewSchema, input);
}

/** Builds the `POST .../review` body from validated form data. */
export function toPostReviewBody(input: ReviewFormInput): PostBookingReviewBody {
  return {
    rating: input.rating,
    body: input.body,
    image_urls: input.image_urls,
  };
}

/**
 * Reads the `?rate=` deep-link (from the dashboard review nudge) as a 1–5
 * rating, or `undefined` when it is absent or out of range.
 */
export function parseDeepLinkRating(raw: string | null): number | undefined {
  const value = Number(raw ?? "");
  return value >= 1 && value <= 5 ? value : undefined;
}
