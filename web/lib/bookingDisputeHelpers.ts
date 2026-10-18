import type { Tone } from "@/lib/tone";

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

/** Badge tone for a dispute case status. */
export function participantDisputeStatusTone(status: string): Tone {
  switch (status) {
    case "open":
      return "warning";
    case "under_review":
      return "info";
    case "resolved":
      return "success";
    default:
      return "neutral";
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
