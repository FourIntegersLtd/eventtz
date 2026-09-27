/**
 * The dispute summary field and the confirm-step copy, ported from the
 * baseline `disputeSummarySchema` (`messageBodySchema` min 10, max 4000,
 * label "Summary") and `BOOKING_CONFIRM_COPY.openDispute`.
 */
import { z } from "zod";
import { parseForm, type ParseFail, type ParseOk } from "@/domains/client-bookings/parseForm";

/** Shortest summary the baseline accepts, after trimming. */
export const DISPUTE_SUMMARY_MIN_LENGTH = 10;

/** Longest summary the baseline accepts, after trimming. */
export const DISPUTE_SUMMARY_MAX_LENGTH = 4000;

export const disputeSummarySchema = z.object({
  summary: z
    .string()
    .trim()
    .min(DISPUTE_SUMMARY_MIN_LENGTH, "Please enter at least 10 characters.")
    .max(DISPUTE_SUMMARY_MAX_LENGTH, "Summary is too long."),
});

export type DisputeSummaryInput = z.infer<typeof disputeSummarySchema>;

/** Validates the summary textarea. A failure carries the baseline message. */
export function parseDisputeSummary(input: unknown): ParseOk<DisputeSummaryInput> | ParseFail {
  return parseForm(disputeSummarySchema, input);
}

/** Confirm step before a dispute is filed. `destructive` on the dialog matches the baseline. */
export const OPEN_DISPUTE_CONFIRM = {
  title: "Report a problem?",
  description:
    "Tell us what went wrong. We'll look into it and pause any payment to the vendor until it's resolved. Keep messages on Eventtz so we have a clear record.",
  cancelLabel: "Go back",
  confirmLabel: "Submit report",
  confirmLoadingLabel: "Submitting…",
} as const;

/** Shown inline after a dispute is filed. The baseline used this as a success toast title. */
export const DISPUTE_OPENED_MESSAGE = "Dispute opened";

/** Fallback when the booking's disputes cannot be loaded. */
export const DISPUTE_LOAD_FAILED = "Could not load dispute status.";

/** Fallback when filing fails and the API sent no detail. */
export const DISPUTE_SUBMIT_FAILED = "Could not submit dispute.";

/**
 * Fallback when the API answers `dispute_already_open` with no detail.
 * The baseline booking page has no dedicated string for that code; it shows
 * the API detail, which is "A dispute is already open or under review for
 * this booking." This sentence is only the empty-detail fallback.
 */
export const DISPUTE_ALREADY_OPEN_FALLBACK = "There is already an open dispute on this booking.";
