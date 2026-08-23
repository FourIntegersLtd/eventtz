/** Plain-language copy for booking confirmation dialogs and payment explainers. */

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
  withdrawQuote: {
    title: "Withdraw this quote?",
    description:
      "The client will no longer be able to accept this quote. You can send a new quote later if needed.",
    cancelLabel: "Keep quote",
    confirmLabel: "Withdraw quote",
    confirmLoadingLabel: "Withdrawing…",
  },
  cancelVendor: {
    title: "Cancel this booking?",
    description:
      "This ends the booking. The client hasn't paid yet, so no money changes hands. They will be notified.",
    cancelLabel: "Keep booking",
    confirmLabel: "Yes, cancel",
    confirmLoadingLabel: "Cancelling…",
  },
  cancelVendorPaid: {
    title: "Cancel this booking?",
    description:
      "This ends the booking. The client has already paid, so they'll automatically get a full refund back to their card. You won't be paid for this booking.",
    cancelLabel: "Keep booking",
    confirmLabel: "Yes, cancel",
    confirmLoadingLabel: "Cancelling…",
  },
  declineBooking: {
    title: "Can't take this booking?",
    description:
      "The client will be notified that you can't take this request. They can try another vendor or send a new request.",
    cancelLabel: "Go back",
    confirmLabel: "Yes, decline",
    confirmLoadingLabel: "Declining…",
  },
  acceptBooking: {
    title: "Accept this booking?",
    description:
      "You'll confirm you're available at the listed price. The client will be asked to pay to secure the booking.",
    cancelLabel: "Go back",
    confirmLabel: "Yes, accept",
    confirmLoadingLabel: "Accepting…",
  },
  reviewUnreadBeforeRespond: {
    title: "Review their message first",
    description:
      "This client sent you a message with details for the booking. Open the chat and read it before you accept or decline.",
    cancelLabel: "Go back",
    confirmLabel: "Open chat",
  },
  openDispute: {
    title: "Report a problem?",
    description:
      "Tell us what went wrong. We'll look into it and pause any payment to the vendor until it's resolved. Keep messages on Eventtz so we have a clear record.",
    cancelLabel: "Go back",
    confirmLabel: "Submit report",
    confirmLoadingLabel: "Submitting…",
  },
} as const;

/** The one-line payment story, reused wherever money is explained. */
export const PAYMENT_FLOW_COPY = {
  /** Shown before/at checkout so the client knows where their money goes. */
  beforePay:
    "Your payment stays safely with Eventtz until your event is done. We pay your vendor once you both confirm everything went well, or automatically 48 hours after the event when all is well.",
  /** Payment success banner (client). */
  paymentSuccess:
    "Thank you, your payment is received. We are holding it safely until your event is complete. After your event, please confirm everything went well so your vendor can be paid. If anything was not right, you have 48 hours to report a problem and we will help.",
  /** Stripe return URL landed with payment=cancelled. */
  paymentCancelledReturn: "Payment cancelled. Try again when you're ready.",
  /** Stripe return URL while webhook/sync is still catching up. */
  paymentConfirming: "Confirming your payment…",
  /** Sync failed after a successful Checkout; webhook may still complete. */
  paymentSyncPending:
    "Payment went through. Refresh in a moment if it doesn't update.",
  paymentDueTitle: "Payment needed",
  paymentDueSubtitle: "Pay now to confirm your booking.",
  payNowLabel: "Pay now",
  /** Deep-link to /pay when the booking is not accepted + unpaid/pending. */
  payNotReady:
    "This booking isn't ready for payment. Go back to the booking for the current status.",
  /** Cancelled + refunded booking state (client). */
  cancelledRefunded:
    "This booking was cancelled and your payment was refunded in full. Refunds usually take 5-10 working days to reach your card.",
  /** Cancelled + refunded booking state (vendor). */
  cancelledRefundedVendor:
    "This booking was cancelled. The client's payment was refunded in full.",
  /** Both sides confirmed but payout transfer is still processing or retrying. */
  payoutPendingVendor: {
    title: "Payout not released yet",
    body: "You and the client both confirmed this event. We're releasing your payout now — tap below if nothing has changed after a minute.",
  },
  payoutPendingClient: {
    title: "Paying your vendor",
    body: "You've both confirmed the event went well. We're releasing the vendor's payout now — this usually takes a moment.",
  },
} as const;

/** Client booking mutation toasts and inline error fallbacks. */
export const CLIENT_BOOKING_TOAST_COPY = {
  bookingCancelled: "Booking cancelled",
  quoteAccepted: "Quote accepted",
  quoteDeclined: "Quote declined",
  priceUpdateAccepted: "Price update accepted",
  priceUpdateDeclined: "Price update declined",
  completionConfirmed: "Completion confirmed",
  reviewSubmitted: "Review submitted",
  requestSent: "Request sent",
  requestsSent: (count: number) => `${count} requests sent`,
  requestsNotSent: "Requests not sent",
  partialRequestsSent: (sent: number, total: number) => `${sent} of ${total} requests sent`,
} as const;

export const CLIENT_BOOKING_ERROR_COPY = {
  cancelFailed: "Could not cancel this booking.",
  quoteFailed: "Could not update this quote.",
  priceUpdateFailed: "Could not update this booking.",
  completionFailed: "Could not confirm completion.",
  reviewFailed: "Could not submit your review.",
  enquiryFailed: "Request failed. Try again.",
  multiEnquireNone: "Could not send any requests.",
} as const;

/** Client dashboard attention-feed nudges (quotes, completion). */
export const CLIENT_DASHBOARD_COPY = {
  quoteTitle: (vendorName: string) => `Quote from ${vendorName}`,
  quoteCta: "Review",
  completionWaitTitle: (vendorName: string) => `Waiting for ${vendorName} to confirm`,
  completionWaitSubtitle: (eventName: string) =>
    `${eventName} · you've confirmed - the vendor is paid once they confirm too`,
  completionConfirmTitle: "How did your event go?",
  completionConfirmSubtitle: (eventName: string) =>
    `${eventName} · confirm it's complete, or report a problem`,
  completionCta: "Confirm",
  completionViewCta: "View",
} as const;

/** Pay-page venue step and checkout preamble. */
export const CLIENT_PAY_PAGE_COPY = {
  venueTitle: "Event location",
  venueIntro:
    "We need your event address before you pay. You will see how we protect your payment on the next step.",
  safetyIntro: "Review how we protect your payment, then continue.",
} as const;

/** Closed booking outcomes shown on detail views (declined / cancelled without refund). */
export const BOOKING_OUTCOME_COPY = {
  declined: "This booking request was declined. No payment was taken.",
  cancelled: "This booking was cancelled.",
} as const;

/** Pre-checkout modal and post-payment email: how client funds are protected. */
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
export function autoReleaseLine(
  autoReleaseAt: string,
  viewer: "client" | "vendor",
): string {
  const date = new Date(autoReleaseAt);
  const label = Number.isNaN(date.getTime())
    ? "soon"
    : date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  return viewer === "client"
    ? `If we do not hear from you, we will pay your vendor automatically on ${label}, unless you have reported a problem. We are here if you need us.`
    : `If the client does not respond, you will be paid automatically on ${label} unless they have reported a problem.`;
}

export const ADMIN_CONFIRM_COPY = {
  closeDispute: {
    title: "Close this dispute?",
    description: "The case will be marked closed. Participants can still view the history.",
    confirmLabel: "Close dispute",
  },
  suspendClient: {
    title: "Suspend client?",
    description: "They won't be able to sign in or make new bookings until you unsuspend them.",
    confirmLabel: "Suspend",
  },
  unsuspendClient: {
    title: "Unsuspend client?",
    description: "They'll be able to sign in and use the platform again.",
    confirmLabel: "Unsuspend",
  },
  hideReview: {
    title: "Hide review from profile?",
    description: "Visitors won't see this review on the vendor's public profile. You can show it again later.",
    confirmLabel: "Hide",
  },
  showReview: {
    title: "Show review publicly?",
    description: "This review will appear on the vendor's public profile again.",
    confirmLabel: "Show",
  },
} as const;

type CompletionTimestamps = {
  booking_status: string;
  payment_status: string;
  client_completion_confirmed_at?: string | null;
  vendor_completion_confirmed_at?: string | null;
};

/** Both parties confirmed but the vendor payout has not been released yet. */
export function isPayoutReleasePending(detail: CompletionTimestamps): boolean {
  return (
    detail.booking_status === "accepted" &&
    detail.payment_status === "paid" &&
    Boolean(detail.client_completion_confirmed_at) &&
    Boolean(detail.vendor_completion_confirmed_at)
  );
}
