import { Suspense } from "react";
import { LoadingState } from "@/foundation/ui";
import { BookingsListView } from "@/domains/client-bookings/BookingsListView";

/**
 * `/client/bookings` — the client's bookings, grouped by active/closed. The
 * list reads `?tab=` and `?status=`, so it renders inside Suspense.
 */
export default function ClientBookingsPage() {
  return (
    <Suspense fallback={<LoadingState variant="inline" label="Loading bookings…" />}>
      <BookingsListView />
    </Suspense>
  );
}
