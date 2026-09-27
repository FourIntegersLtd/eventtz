import { Suspense } from "react";
import { Spinner } from "@/foundation/ui";
import { BookingsListView } from "@/domains/client-bookings/BookingsListView";

/**
 * `/client/bookings` — the client's bookings, grouped by active/closed. The
 * list reads `?tab=` and `?status=`, so it renders inside Suspense.
 */
export default function ClientBookingsPage() {
  return (
    <Suspense fallback={<Spinner label="Loading bookings…" />}>
      <BookingsListView />
    </Suspense>
  );
}
