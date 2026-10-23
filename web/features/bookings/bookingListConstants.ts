/** `closed` covers every booking that is no longer active (completed, declined, cancelled); row badges tell them apart. */
export type BookingListTab = "active" | "closed";

export function bookingTabForStatus(status: string): BookingListTab {
  if (status === "pending" || status === "accepted") return "active";
  return "closed";
}

export const BOOKING_EMPTY_LIST_TITLE: Record<BookingListTab, string> = {
  active: "No active bookings",
  closed: "No closed bookings",
};
