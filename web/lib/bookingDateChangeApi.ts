import type { components } from "@/lib/api-schema";
import api from "@/lib/axios";

/** Rescheduling fields the booking detail responses carry (`BookingTermsFields` on the API). */
export type BookingDateChangeFields = Pick<
  components["schemas"]["ClientBookingDetail"],
  | "proposed_event_date"
  | "proposed_event_end_date"
  | "date_change_requested_by"
  | "date_change_requested_at"
  | "date_change_note"
>;

export type DateChangeRole = "client" | "vendor";

export type DateChangeRequestPayload = components["schemas"]["DateChangeRequestBody"];

function dateChangePath(role: DateChangeRole, bookingId: string, suffix = ""): string {
  return `/api/v1/${role}/booking-requests/${encodeURIComponent(bookingId)}/date-change${suffix}`;
}

export async function requestDateChange(
  role: DateChangeRole,
  bookingId: string,
  payload: DateChangeRequestPayload,
): Promise<void> {
  await api.post(dateChangePath(role, bookingId), payload);
}

export async function respondToDateChange(
  role: DateChangeRole,
  bookingId: string,
  accept: boolean,
): Promise<void> {
  await api.post(dateChangePath(role, bookingId, "/respond"), { accept } satisfies components["schemas"]["DateChangeRespondBody"]);
}

export async function withdrawDateChange(role: DateChangeRole, bookingId: string): Promise<void> {
  await api.post(dateChangePath(role, bookingId, "/withdraw"));
}

/** What to tell the user for each stable error code; unknown codes fall back to the API message. */
export const DATE_CHANGE_ERROR_COPY: Record<string, string> = {
  date_change_capacity_full:
    "The vendor is fully booked on the new date, so the date could not be moved. Try another date.",
  date_change_pending: "A date change is already waiting for an answer.",
  date_change_not_allowed: "The date can only be changed on an accepted booking that is not complete.",
  no_date_change: "That date change is no longer waiting. Refresh to see the latest.",
  date_change_not_yours: "You cannot do that with this date change.",
  date_change_invalid_dates: "Choose a date that is today or later, with the end on or after the start.",
};
