/** Validates cancel-on-behalf support action fields (`adminCancelBookingSchema`). */

export function validateCancelOnBehalfReason(reason: string): string | null {
  const trimmed = reason.trim();
  if (trimmed.length < 3) return "Enter a short reason (at least 3 characters).";
  if (trimmed.length > 2000) return "Reason is too long.";
  return null;
}
