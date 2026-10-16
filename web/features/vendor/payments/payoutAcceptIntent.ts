const STORAGE_KEY = "eventtz:pendingAcceptBookingId";

/** Persist Accept intent across Stripe Connect redirect. */
export function setPendingAcceptBookingId(bookingId: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, bookingId);
  } catch {
    // ignore quota / private mode
  }
}

export function getPendingAcceptBookingId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearPendingAcceptBookingId(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
