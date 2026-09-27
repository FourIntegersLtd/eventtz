/**
 * Pure decisions for the Stripe return on the booking detail page.
 *
 * The browser never writes `payment_status`. These helpers only describe the
 * banner and the sync request body; the hook performs the one sync call.
 */
import type { components } from "@/foundation/platform-client";
import { PAYMENT_FLOW_COPY } from "@/domains/client-bookings/bookingCopy";

export type CheckoutReturnTone = "amber" | "red" | "green";

export interface CheckoutReturnBanner {
  show: boolean;
  tone: CheckoutReturnTone;
  message: string;
}

/** Paid, or the vendor has already been paid out — the client has nothing left to pay. */
export function paymentIsConfirmed(paymentStatus: string | null | undefined): boolean {
  return paymentStatus === "paid" || paymentStatus === "payout_released";
}

/**
 * Banner for `?payment=success|cancelled`. Cancelled is amber and stays.
 * A sync failure is red and wins over the success copy. Otherwise a confirmed
 * payment is the thank-you message and an in-flight one is "confirming".
 */
export function checkoutReturnBanner(input: {
  paymentParam: string | null;
  paymentStatus: string | null | undefined;
  syncError: string | null;
}): CheckoutReturnBanner {
  if (input.paymentParam === "cancelled") {
    return { show: true, tone: "amber", message: PAYMENT_FLOW_COPY.paymentCancelledReturn };
  }
  if (input.paymentParam !== "success") {
    return { show: false, tone: "green", message: "" };
  }
  if (input.syncError) {
    return { show: true, tone: "red", message: input.syncError };
  }
  if (paymentIsConfirmed(input.paymentStatus)) {
    return { show: true, tone: "green", message: PAYMENT_FLOW_COPY.paymentSuccess };
  }
  return { show: true, tone: "green", message: PAYMENT_FLOW_COPY.paymentConfirming };
}

/**
 * Body for `POST .../checkout/sync`. Stripe's success URL includes a session
 * id; a background sync of a pending booking does not, and sends `{}`.
 */
export function checkoutSyncBody(
  sessionId: string | null | undefined,
): components["schemas"]["BookingCheckoutSyncBody"] {
  if (sessionId) return { session_id: sessionId };
  return {};
}

/** Detail URL for one booking. The id is encoded so it survives the path. */
export function clientBookingHref(bookingId: string): string {
  return `/client/bookings/${encodeURIComponent(bookingId)}`;
}
