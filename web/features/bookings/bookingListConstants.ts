import type { BookingListTab } from "@/features/bookings/BookingListPanel";

export function bookingTabForStatus(status: string): BookingListTab {
  if (status === "pending" || status === "accepted") return "active";
  return "closed";
}

export const BOOKING_EMPTY_LIST_TITLE: Record<BookingListTab, string> = {
  active: "No active bookings",
  closed: "No closed bookings",
};
