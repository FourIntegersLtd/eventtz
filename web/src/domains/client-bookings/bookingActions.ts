/**
 * Action gating and completion helpers for a client booking, ported from the
 * baseline's `useClientBookingsController` + `useClientBookingActions`, the
 * shared `bookingConfirmCopy.ts`, `eventDay.ts` and `bookingPayHelpers.ts`.
 * Pure and testable; the components read these to decide which buttons show.
 */

/** True once the event day (UTC) has fully passed — post-event nudges start then. */
export function eventDayOver(eventDate: string, eventEndDate?: string | null): boolean {
  const dayString = (eventEndDate || eventDate || "").slice(0, 10);
  const day = new Date(`${dayString}T00:00:00Z`);
  if (Number.isNaN(day.getTime())) return false;
  return Date.now() >= day.getTime() + 24 * 60 * 60 * 1000;
}

/** True when the client must enter a venue address before Checkout. */
export function bookingNeedsVenue(eventAddress: string | null | undefined): boolean {
  return !Boolean(eventAddress?.trim());
}

/** Checkout is allowed only for accepted bookings that are still unpaid or in-flight. */
export function bookingCanBePaid(booking: {
  booking_status: string;
  payment_status: string;
}): boolean {
  return (
    booking.booking_status === "accepted" &&
    (booking.payment_status === "unpaid" || booking.payment_status === "pending")
  );
}

/** Both parties confirmed but the vendor payout has not been released yet. */
export function isPayoutReleasePending(detail: {
  booking_status: string;
  payment_status: string;
  client_completion_confirmed_at?: string | null;
  vendor_completion_confirmed_at?: string | null;
}): boolean {
  return (
    detail.booking_status === "accepted" &&
    detail.payment_status === "paid" &&
    Boolean(detail.client_completion_confirmed_at) &&
    Boolean(detail.vendor_completion_confirmed_at)
  );
}

/**
 * The post-event "how did it go?" banner, from the baseline's
 * `BookingCompletionBanner`: only for an accepted, paid booking the server says
 * is waiting on someone, and only once the event day is over. Null hides it.
 */
export function completionBannerState(detail: {
  booking_status: string;
  payment_status: string;
  event_date: string;
  event_end_date?: string | null;
  completion_waiting_on?: "client" | "vendor" | "both" | null;
}): { waitingOn: "client" | "vendor" | "both"; clientNeedsToConfirm: boolean } | null {
  const waitingOn = detail.completion_waiting_on;
  if (detail.booking_status !== "accepted" || detail.payment_status !== "paid" || !waitingOn) return null;
  if (!eventDayOver(detail.event_date, detail.event_end_date)) return null;
  return { waitingOn, clientNeedsToConfirm: waitingOn === "both" || waitingOn === "client" };
}

export type ClientBookingActionSource = {
  booking_status: string;
  payment_status: string;
  initiator: "client" | "vendor";
  vendor_adjustments?: { id: string }[] | null;
  client_completion_confirmed_at?: string | null;
  vendor_completion_confirmed_at?: string | null;
};

export type ClientBookingActions = {
  /** The client may cancel (pending/accepted, not already paid out, not an un-answered quote). */
  canCancel: boolean;
  /** Accepted + paid + the client has not yet confirmed the event went well. */
  canConfirmCompletion: boolean;
  /** A vendor-sent quote is still waiting on the client's accept/decline. */
  canRespondToQuote: boolean;
  /** The vendor updated the price and the client must accept or decline it. */
  canRespondToPriceUpdate: boolean;
  /** The "new price, your response needed" banner shows. */
  showUpdatedPriceBanner: boolean;
  /** Accepted + unpaid/pending — the "Pay now" banner shows. */
  paymentDue: boolean;
  /** Cancelled with a full/partial refund — the "cancelled and refunded" notice shows. */
  showCancelledRefunded: boolean;
  /** Payout release is in flight after both sides confirmed. */
  isPayoutReleasePending: boolean;
};

/**
 * Every status-changing action the client can take, keyed off the booking's
 * state. Mirrors the server's own transition rules so a hidden button here is
 * one the API would reject anyway.
 */
export function clientBookingActions(detail: ClientBookingActionSource): ClientBookingActions {
  const canCancel =
    (detail.booking_status === "pending" || detail.booking_status === "accepted") &&
    detail.payment_status !== "payout_released" &&
    !(detail.initiator === "vendor" && detail.booking_status === "pending");

  return {
    canCancel,
    canConfirmCompletion:
      detail.booking_status === "accepted" &&
      detail.payment_status === "paid" &&
      !detail.client_completion_confirmed_at,
    canRespondToQuote: detail.initiator === "vendor" && detail.booking_status === "pending",
    canRespondToPriceUpdate:
      detail.initiator === "client" &&
      detail.booking_status === "pending" &&
      (detail.vendor_adjustments?.length ?? 0) > 0,
    showUpdatedPriceBanner:
      detail.initiator === "client" &&
      detail.booking_status === "pending" &&
      (detail.vendor_adjustments?.length ?? 0) > 0,
    paymentDue: bookingCanBePaid(detail),
    showCancelledRefunded:
      detail.booking_status === "cancelled" &&
      (detail.payment_status === "refunded" || detail.payment_status === "partially_refunded"),
    isPayoutReleasePending: isPayoutReleasePending(detail),
  };
}

/** Post-event banner copy: who we're waiting on, tailored to the viewer. */
export function completionWaitingCopy(
  waitingOn: "client" | "vendor" | "both",
  viewer: "client" | "vendor",
): { title: string; body: string } {
  const viewerNeedsToConfirm = waitingOn === "both" || waitingOn === viewer;
  if (viewerNeedsToConfirm) {
    return viewer === "client"
      ? {
          title: "How did your event go?",
          body: "If everything went well, confirm it's complete so the vendor can be paid. If something went wrong, report a problem.",
        }
      : {
          title: "Confirm the event is complete",
          body: "Confirm the event is done to get paid sooner.",
        };
  }
  const other = viewer === "client" ? "vendor" : "client";
  return {
    title: `Waiting for the ${other} to confirm`,
    body: `You've confirmed the event went well. We're waiting for the ${other} to confirm on their side.`,
  };
}

/** "We'll pay the vendor automatically on [date]" line for the completion banner. */
export function autoReleaseLine(autoReleaseAt: string, viewer: "client" | "vendor"): string {
  const date = new Date(autoReleaseAt);
  const label = Number.isNaN(date.getTime())
    ? "soon"
    : date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  return viewer === "client"
    ? `If we do not hear from you, we will pay your vendor automatically on ${label}, unless you have reported a problem. We are here if you need us.`
    : `If the client does not respond, you will be paid automatically on ${label} unless they have reported a problem.`;
}
