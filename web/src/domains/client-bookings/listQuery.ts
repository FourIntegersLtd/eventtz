/**
 * Reads the `/client/bookings` query string the way the baseline's
 * `useClientBookingsController` does: `?tab=active|closed` picks the tab and
 * `?status=pending` narrows the list to pending bookings. Anything else is ignored.
 */
import type { BookingListTab } from "@/domains/client-bookings/bookingCopy";

/** The tab and status filter a bookings-list URL asks for. */
export type BookingsListQuery = {
  tab: BookingListTab;
  status: "pending" | undefined;
};

/** Parses the tab and status filter; an unknown or missing value falls back to the active tab, unfiltered. */
export function parseBookingsListQuery(tabParam: string | null, statusParam: string | null): BookingsListQuery {
  return {
    tab: tabParam === "closed" ? "closed" : "active",
    status: statusParam === "pending" ? "pending" : undefined,
  };
}
