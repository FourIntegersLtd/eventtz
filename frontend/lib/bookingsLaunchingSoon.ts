/** When true, clients can browse vendors but cannot send booking requests yet. */
export const BOOKINGS_LAUNCHING_SOON = true;

/**
 * Emails that can send booking requests before general launch (internal testing,
 * early access). Lowercased so a comparison can skip re-normalizing on every call.
 */
const BOOKING_EARLY_ACCESS_EMAILS = new Set(["y.hkehinde@yahoo.com"]);

export function hasBookingEarlyAccess(email: string | null | undefined): boolean {
  if (!email) return false;
  return BOOKING_EARLY_ACCESS_EMAILS.has(email.trim().toLowerCase());
}
