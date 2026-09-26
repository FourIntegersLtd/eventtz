import { platformRequest, type components } from "@/foundation/platform-client";

/** One booking as the vendor's dashboard needs it: status, dates, and payment state. */
export type VendorBookingListItem = components["schemas"]["VendorBookingListItem"];
type VendorBookingsListResponse = components["schemas"]["VendorBookingsListResponse"];

/**
 * The vendor's active bookings, for the dashboard's counts and calendar.
 *
 * Read-only here — accepting/declining/quoting a booking belongs to the
 * bookings workstream (`vendor/(portal)/bookings/**`), which this domain
 * does not own.
 */
export async function fetchActiveBookings(): Promise<VendorBookingListItem[]> {
  const response = await platformRequest<VendorBookingsListResponse>("/api/v1/vendor/booking-requests", {
    query: { group: "active" },
  });
  return response.bookings;
}
