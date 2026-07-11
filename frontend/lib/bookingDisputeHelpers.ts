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
