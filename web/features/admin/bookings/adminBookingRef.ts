/** Public-style booking reference for admin tables and headings. */
export function adminBookingRef(bookingId: string): string {
  const tail = bookingId.replace(/-/g, "").slice(-5).toUpperCase();
  return `EZ-${tail}`;
}
