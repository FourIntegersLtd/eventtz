import { BookingDetailView } from "@/domains/vendor-bookings/BookingDetailView";

type PageProps = {
  params: Promise<{ bookingId: string }>;
};

/** `/vendor/bookings/[bookingId]` — one booking's full detail. */
export default async function VendorBookingDetailPage({ params }: PageProps) {
  const { bookingId } = await params;
  return <BookingDetailView key={bookingId} bookingId={bookingId} />;
}
