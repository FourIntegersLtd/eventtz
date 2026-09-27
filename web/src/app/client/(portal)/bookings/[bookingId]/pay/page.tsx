import { BookingPayView } from "@/domains/client-bookings/BookingPayView";

type PageProps = {
  params: Promise<{ bookingId: string }>;
};

/** `/client/bookings/[bookingId]/pay` — venue, payment safety, then Stripe Checkout. */
export default async function ClientBookingPayPage({ params }: PageProps) {
  const { bookingId } = await params;
  return <BookingPayView key={bookingId} bookingId={bookingId} />;
}
