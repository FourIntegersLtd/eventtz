import type { VendorBookingListItem } from "@/domains/vendor-dashboard/api";

/**
 * Pure counting/formatting helpers for the dashboard's summary tiles.
 *
 * Ported (simplified) from the baseline's `useVendorDashboard` counters —
 * kept separate from the view so the counting logic is testable without
 * mounting a component or mocking `fetch`.
 */

/** Every active booking, regardless of status. */
export function activeBookingsCount(bookings: readonly VendorBookingListItem[]): number {
  return bookings.length;
}

/** Bookings still waiting on the vendor's first reply. */
export function pendingBookingsCount(bookings: readonly VendorBookingListItem[]): number {
  return bookings.filter((booking) => booking.booking_status === "pending").length;
}

/** Upcoming bookings (today or later), soonest first, capped for the agenda list. */
export function upcomingAgenda(
  bookings: readonly VendorBookingListItem[],
  today: Date,
  limit = 5,
): VendorBookingListItem[] {
  const todayKey = today.toISOString().slice(0, 10);
  return bookings
    .filter((booking) => booking.event_date.slice(0, 10) >= todayKey)
    .sort((first, second) => first.event_date.localeCompare(second.event_date))
    .slice(0, limit);
}
