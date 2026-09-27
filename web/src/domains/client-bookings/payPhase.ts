/**
 * Which step the pay page opens on, from the booking the server returned.
 * The browser never decides a price; it only chooses venue vs safety vs
 * "not payable" so we don't start a checkout the API would reject.
 */
import { bookingCanBePaid, bookingNeedsVenue } from "@/domains/client-bookings/bookingActions";

export type InitialPayPhase = "venue" | "safety" | "notPayable";

/** The first screen after the booking loads: collect a venue, show the safety modal, or stop. */
export function initialPayPhase(booking: {
  booking_status: string;
  payment_status: string;
  event_address?: string | null;
}): InitialPayPhase {
  if (!bookingCanBePaid(booking)) return "notPayable";
  if (bookingNeedsVenue(booking.event_address)) return "venue";
  return "safety";
}
