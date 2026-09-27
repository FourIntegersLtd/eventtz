/**
 * The pure logic behind `/client/contact`: validation, the request body, and
 * the message shown when a send fails.
 *
 * It lives in a plain `.ts` module because the test runner is `node --test`
 * over `*.test.ts` and cannot import JSX; `ContactView.tsx` keeps only the
 * rendering and the form state.
 */
import { isPlatformError, type PlatformErrorCode } from "@/foundation/platform-client/errors";
import type { ContactSubmitBody } from "@/domains/client-contact/api";

/** Shown for an empty message, which we catch before spending a request on it. */
export const CONTACT_MESSAGE_REQUIRED = "Enter a message before sending.";

/** Shown when a send fails for a reason we have no more specific copy for. */
export const CONTACT_SEND_FAILED = "Could not send your message. Try again.";

/**
 * Our copy for the codes this endpoint can answer with. The API raises each
 * of these with its default message, so the text the client reads is the same
 * as before — but keyed on `code`, which is the part that is stable.
 */
const CONTACT_ERROR_MESSAGES: Partial<Record<PlatformErrorCode, string>> = {
  contact_message_too_short: "Please enter at least 10 characters.",
  contact_invalid_booking_reference: "That booking reference doesn't look right.",
  contact_booking_not_found: "Booking not found.",
  contact_booking_not_on_account: "That booking is not on your account.",
};

/** `null` when the message is worth sending, otherwise the error to show. */
export function validateContactMessage(message: string): string | null {
  return message.trim() ? null : CONTACT_MESSAGE_REQUIRED;
}

/** The request body: both fields trimmed, a blank booking reference sent as `null`. */
export function buildContactRequestBody(message: string, bookingId: string): ContactSubmitBody {
  return { message: message.trim(), booking_id: bookingId.trim() || null };
}

/** What to show after a failed send: our copy for a known `contact_*` code, the API's detail otherwise. */
export function contactErrorMessage(error: unknown): string {
  if (!isPlatformError(error)) return CONTACT_SEND_FAILED;
  return CONTACT_ERROR_MESSAGES[error.code] ?? error.detail;
}
