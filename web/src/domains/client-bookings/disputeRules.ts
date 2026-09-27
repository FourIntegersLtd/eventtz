/**
 * When a client may open a dispute, and how an existing case is labelled
 * on the booking page.
 *
 * Rules mirror the baseline `canOpenDisputeForBookingStatus` and
 * `participantDisputeStatusLabel` / badge classes. This copy lives here,
 * not in `domains/disputes`, because a domain may not import another domain
 * and the booking page files the dispute itself.
 */

/** Booking statuses that accept a new dispute. Cancelled and declined do not. */
export const BOOKING_STATUSES_CAN_OPEN_DISPUTE = ["pending", "accepted", "completed"] as const;

/** How often the booking page re-reads its disputes, matching the baseline `POLL_MS`. */
export const DISPUTE_POLL_MS = 50_000;

const DISPUTE_STATUS_LABELS: Readonly<Record<string, string>> = {
  open: "Open",
  under_review: "Under review",
  resolved: "Resolved",
  closed: "Closed",
};

const DISPUTE_STATUS_BADGE_CLASS: Readonly<Record<string, string>> = {
  open: "bg-amber-100 text-amber-900",
  under_review: "bg-sky-100 text-sky-900",
  resolved: "bg-emerald-100 text-emerald-900",
  closed: "bg-neutral-200 text-neutral-700",
};

/** True when the booking's own status allows a new dispute. */
export function canOpenDisputeForBookingStatus(status: string): boolean {
  return (BOOKING_STATUSES_CAN_OPEN_DISPUTE as readonly string[]).includes(status);
}

/** An open or under-review case blocks another one on the same booking. */
export function disputeIsActive(status: string): boolean {
  return status === "open" || status === "under_review";
}

/**
 * Offer "open a dispute" only when the booking status allows it and no
 * dispute on the booking is still active.
 */
export function canOfferOpenDispute(bookingStatus: string, disputeStatuses: readonly string[]): boolean {
  return canOpenDisputeForBookingStatus(bookingStatus) && !disputeStatuses.some(disputeIsActive);
}

/** A human label for a dispute's `status`; an unknown code is shown as-is. */
export function disputeStatusLabel(status: string): string {
  return DISPUTE_STATUS_LABELS[status] ?? status;
}

/** Tailwind classes for the status pill on the booking page. */
export function disputeStatusBadgeClass(status: string): string {
  return DISPUTE_STATUS_BADGE_CLASS[status] ?? "bg-neutral-100 text-neutral-700";
}

/** "Outcome: " once the case is finished, otherwise "Update: ". Includes the trailing space. */
export function disputeResolutionPrefix(status: string): "Outcome: " | "Update: " {
  return status === "resolved" || status === "closed" ? "Outcome: " : "Update: ";
}

/** When the dispute was opened, or "" when the API sent no timestamp. */
export function disputeOpenedAtLabel(createdAt: string | null | undefined): string {
  if (!createdAt) return "";
  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) return createdAt;
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}
