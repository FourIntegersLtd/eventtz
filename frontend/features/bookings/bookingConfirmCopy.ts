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
      "This ends the booking. The vendor will be notified and you won't be charged the updated amount.",
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
    "We keep your payment safe until the event is done. The vendor is paid once you both confirm it went well — or automatically 48 hours after the event if there's no problem.",
  /** Payment success banner (client). */
  paymentSuccess:
    "Payment received — we'll keep it safe until the event is done. After the event, confirm it went well and the vendor gets paid.",
  /** Cancelled + refunded booking state (client). */
  cancelledRefunded:
    "This booking was cancelled and your payment was refunded in full. Refunds usually take 5-10 working days to reach your card.",
  /** Cancelled + refunded booking state (vendor). */
  cancelledRefundedVendor:
    "This booking was cancelled. The client's payment was refunded in full.",
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
    ? `If we don't hear from you, we'll pay the vendor automatically on ${label} — unless you've reported a problem.`
    : `If the client doesn't respond, you'll be paid automatically on ${label} unless they've reported a problem.`;
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
