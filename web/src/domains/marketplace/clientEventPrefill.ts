/**
 * Turn a client event into the booking form's name, dates, and venue.
 * The modal uses this to link an existing event or offer the active one.
 */

const SKIP_PREFILL_KEY = "eventtz.skip_event_prefill";

/** The event fields the booking form can copy. */
export type ClientEventForPrefill = {
  id: string;
  title: string;
  event_date: string;
  event_end_date: string | null;
  event_address: string | null;
  status: string;
  booking_count: number;
  active_booking_count: number;
  updated_at: string;
};

/** What the form writes when the client picks an event. */
export type ClientEventPrefill = {
  eventId: string;
  eventName: string;
  eventDate: string;
  eventEndDate: string;
  venueAddress: string;
};

/** Copy an event row into form fields. */
export function eventToPrefill(event: ClientEventForPrefill): ClientEventPrefill {
  return {
    eventId: event.id,
    eventName: event.title,
    eventDate: event.event_date,
    eventEndDate: event.event_end_date ?? "",
    venueAddress: event.event_address ?? "",
  };
}

/**
 * The event to offer first: most active bookings, then most bookings,
 * then the most recently updated.
 */
export function pickPrimaryClientEvent(
  events: readonly ClientEventForPrefill[],
): ClientEventForPrefill | null {
  const active = events.filter((event) => event.status === "active");
  if (active.length === 0) return null;
  const ranked = [...active].sort((left, right) => {
    const byActive = right.active_booking_count - left.active_booking_count;
    if (byActive !== 0) return byActive;
    const byBookings = right.booking_count - left.booking_count;
    if (byBookings !== 0) return byBookings;
    return right.updated_at.localeCompare(left.updated_at);
  });
  return ranked[0] ?? null;
}

/** Remember that this browser tab does not want the "same event?" prompt. */
export function setSkipEventPrefillForSession(skip: boolean): void {
  try {
    if (skip) sessionStorage.setItem(SKIP_PREFILL_KEY, "1");
    else sessionStorage.removeItem(SKIP_PREFILL_KEY);
  } catch {
    /* private mode */
  }
}

/** True after the client chose "new event" in this tab. */
export function shouldSkipEventPrefillPrompt(): boolean {
  try {
    return sessionStorage.getItem(SKIP_PREFILL_KEY) === "1";
  } catch {
    return false;
  }
}
