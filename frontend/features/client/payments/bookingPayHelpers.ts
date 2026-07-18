/** True when the client must enter a venue address before Checkout. */
export function bookingNeedsVenue(eventAddress: string | null | undefined): boolean {
  return !Boolean(eventAddress?.trim());
}
