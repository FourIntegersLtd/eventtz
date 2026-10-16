/** True when the client must enter a venue address before Checkout. */
export function bookingNeedsVenue(eventAddress: string | null | undefined): boolean {
  return !Boolean(eventAddress?.trim());
}

/** Checkout is allowed only for accepted bookings that are still unpaid or in-flight. */
export function bookingCanBePaid(booking: {
  booking_status: string;
  payment_status: string;
}): boolean {
  return (
    booking.booking_status === "accepted" &&
    (booking.payment_status === "unpaid" || booking.payment_status === "pending")
  );
}
