/**
 * User-facing copy for the client bookings domain, ported from the baseline's
 * `bookingConfirmCopy.ts` and `bookingListConstants.ts` (client subset only).
 */

export const CLIENT_BOOKING_ERROR_COPY = {
  cancelFailed: "Could not cancel this booking.",
  quoteFailed: "Could not update this quote.",
  priceUpdateFailed: "Could not update this booking.",
  completionFailed: "Could not confirm completion.",
  reviewFailed: "Could not submit your review.",
} as const;

export const BOOKING_CONFIRM_COPY = {
  cancelClient: {
    title: "Cancel this booking?",
    description:
      "This ends the booking. You haven't paid yet, so you won't be charged. The vendor will be notified.",
    cancelLabel: "Keep booking",
    confirmLabel: "Yes, cancel",
    confirmLoadingLabel: "Cancelling…",
  },
  cancelClientPaid: {
    title: "Cancel this booking?",
    description:
      "This ends the booking and you'll get a full refund back to your card. Refunds usually take 5-10 working days. The vendor will be notified.",
    cancelLabel: "Keep booking",
    confirmLabel: "Cancel and refund me",
    confirmLoadingLabel: "Cancelling…",
  },
  confirmComplete: {
    title: "Confirm the event went well?",
    description:
      "You're saying the event went as planned. Once you and the other party have both confirmed, the vendor gets paid.",
    cancelLabel: "Cancel",
    confirmLabel: "Yes, confirm",
    confirmLoadingLabel: "Confirming…",
  },
  declineQuote: {
    title: "Decline this quote?",
    description:
      "This ends the booking request. The vendor will be notified and you won't be charged.",
    cancelLabel: "Keep quote",
    confirmLabel: "Yes, decline",
    confirmLoadingLabel: "Declining…",
  },
  declineUpdatedPrice: {
    title: "Decline the new price?",
    description:
      "We'll restore the original price. The booking stays open so you can keep chatting with the vendor, or cancel if you're done.",
    cancelLabel: "Go back",
    confirmLabel: "Yes, decline",
    confirmLoadingLabel: "Declining…",
  },
} as const;

/** The cancel dialog's copy: a paid booking is refunded, an unpaid one is not charged. */
export function cancelConfirmCopy(paymentStatus: string) {
  return paymentStatus === "paid" ? BOOKING_CONFIRM_COPY.cancelClientPaid : BOOKING_CONFIRM_COPY.cancelClient;
}

export const PAYMENT_FLOW_COPY = {
  paymentDueTitle: "Payment needed",
  paymentDueSubtitle: "Pay now to confirm your booking.",
  payNowLabel: "Pay now",
  beforePay:
    "Your payment stays safely with Eventtz until your event is done. We pay your vendor once you both confirm everything went well, or automatically 48 hours after the event when all is well.",
  cancelledRefunded:
    "This booking was cancelled and your payment was refunded in full. Refunds usually take 5-10 working days to reach your card.",
  payoutPendingClient: {
    title: "Paying your vendor",
    body: "You've both confirmed the event went well. We're releasing the vendor's payout now — this usually takes a moment.",
  },
  /** Payment success banner (client), from the baseline `bookingConfirmCopy.ts`. */
  paymentSuccess:
    "Thank you, your payment is received. We are holding it safely until your event is complete. After your event, please confirm everything went well so your vendor can be paid. If anything was not right, you have 48 hours to report a problem and we will help.",
  /** Stripe return URL landed with payment=cancelled. */
  paymentCancelledReturn: "Payment cancelled. Try again when you're ready.",
  /** Stripe return URL while webhook/sync is still catching up. */
  paymentConfirming: "Confirming your payment…",
  /** Sync failed after a successful Checkout; webhook may still complete. */
  paymentSyncPending: "Payment went through. Refresh in a moment if it doesn't update.",
  /** Deep-link to /pay when the booking is not accepted + unpaid/pending. */
  payNotReady: "This booking isn't ready for payment. Go back to the booking for the current status.",
} as const;

/** Copy for `/client/bookings/[bookingId]/pay`, from the baseline `CLIENT_PAY_PAGE_COPY`. */
export const CLIENT_PAY_PAGE_COPY = {
  venueTitle: "Event location",
  venueIntro:
    "We need your event address before you pay. You will see how we protect your payment on the next step.",
  safetyIntro: "Review how we protect your payment, then continue.",
} as const;

/** Pre-checkout modal: how client funds are protected. From the baseline `PAYMENT_SAFETY_COPY`. */
export const PAYMENT_SAFETY_COPY = {
  modalTitle: "Your payment is in safe hands",
  intro: "Before you continue, here is how we look after you and your money:",
  points: [
    "Your payment stays safely with Eventtz until your event is complete.",
    "After your event, please confirm everything went well so we can pay your vendor with confidence.",
    "If anything did not go to plan, you have 48 hours after the event to report a problem and we will be here to help.",
    "When all is well, we will release payment to your vendor automatically after 48 hours.",
  ],
  confirmLabel: "Continue to secure payment",
  cancelLabel: "Go back",
} as const;

/** Fallbacks when the API's `detail` is missing on the pay and payment-history screens. */
export const PAYMENT_ERROR_COPY = {
  bookingNotFound: "Booking not found.",
  checkoutFailed: "Could not start checkout. Try again shortly.",
  venueSaveFailed: "We couldn't save your venue address. Please try again.",
  paymentHistoryFailed: "Could not load payment history.",
} as const;

export const BOOKING_OUTCOME_COPY = {
  declined: "This booking request was declined. No payment was taken.",
  cancelled: "This booking was cancelled.",
} as const;

export type BookingListTab = "active" | "closed";

/** Buckets a booking status into the active/closed tabs (`bookingListConstants.ts`). */
export function bookingTabForStatus(status: string): BookingListTab {
  if (status === "pending" || status === "accepted") return "active";
  return "closed";
}

export const BOOKING_EMPTY_LIST_TITLE: Record<BookingListTab, string> = {
  active: "No active bookings",
  closed: "No closed bookings",
};
