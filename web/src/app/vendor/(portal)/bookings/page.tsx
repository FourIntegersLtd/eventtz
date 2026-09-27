import { BookingsListView } from "@/domains/vendor-bookings/BookingsListView";

/** `/vendor/bookings` — the vendor's booking requests, grouped by bucket. */
export default function VendorBookingsPage() {
  return <BookingsListView />;
}
