import { Suspense } from "react";
import { Spinner } from "@/foundation/ui";
import { BookingDetailView } from "@/domains/client-bookings/BookingDetailView";

type PageProps = {
  params: Promise<{ bookingId: string }>;
};

/**
 * `/client/bookings/[bookingId]` — one booking's full detail. The view reads
 * `?payment=` and `?session_id=` after Stripe, so it sits inside Suspense.
 */
export default async function ClientBookingDetailPage({ params }: PageProps) {
  const { bookingId } = await params;
  return (
    <Suspense fallback={<Spinner label="Loading booking…" />}>
      <BookingDetailView key={bookingId} bookingId={bookingId} />
    </Suspense>
  );
}
