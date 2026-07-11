/**
 * Dispute rules mirror `backend/app/services/dispute_service.py`
 * (`_ALLOWED_BOOKING_STATUSES_FOR_NEW_DISPUTE`). Keep in sync when backend changes.
 */
export const BOOKING_STATUSES_CAN_OPEN_DISPUTE = [
  "pending",
  "accepted",
  "completed",
] as const;

export function canOpenDisputeForBookingStatus(status: string): boolean {
  return (BOOKING_STATUSES_CAN_OPEN_DISPUTE as readonly string[]).includes(status);
}

/** Participant-facing dispute case status (API + UI). */
export function participantDisputeStatusLabel(status: string): string {
  switch (status) {
    case "open":
      return "Open";
    case "under_review":
      return "Under review";
    case "resolved":
      return "Resolved";
    case "closed":
      return "Closed";
    default:
      return status;
  }
}

export function participantDisputeStatusBadgeClass(status: string): string {
  switch (status) {
    case "open":
      return "bg-amber-100 text-amber-900";
    case "under_review":
      return "bg-sky-100 text-sky-900";
    case "resolved":
      return "bg-emerald-100 text-emerald-900";
    case "closed":
      return "bg-neutral-200 text-neutral-700";
    default:
      return "bg-neutral-100 text-neutral-700";
  }
}

export function participantDisputeBookingLabel(dispute: {
  event_name?: string | null;
  event_date?: string | null;
}): string {
  if (dispute.event_name) {
    const date = dispute.event_date
      ? ` · ${new Date(dispute.event_date).toLocaleDateString("en-GB", { dateStyle: "medium" })}`
      : "";
    return `${dispute.event_name}${date}`;
  }
  return "Booking";
}
