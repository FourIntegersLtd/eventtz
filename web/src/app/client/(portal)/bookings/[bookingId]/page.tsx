import { BookingDetailView } from "@/domains/client-bookings/BookingDetailView";

type PageProps = {
  params: Promise<{ bookingId: string }>;
};

/** `/client/bookings/[bookingId]` — one booking's full detail. */
export default async function ClientBookingDetailPage({ params }: PageProps) {
  const { bookingId } = await params;
  return <BookingDetailView key={bookingId} bookingId={bookingId} />;
}
