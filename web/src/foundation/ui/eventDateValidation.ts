/** Local calendar dates for event start and end validation. */
/** Today's local calendar date as `YYYY-MM-DD`. */
export function todayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** The `YYYY-MM-DD` prefix of `raw`, or null when it is not a calendar date. */
export function normalizeIsoDate(raw: string): string | null {
  const trimmed = raw.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  return trimmed;
}

/** True when `iso` is a real date strictly before today. Invalid strings are not past. */
export function isPastIsoDate(iso: string): boolean {
  const normalized = normalizeIsoDate(iso);
  if (!normalized) return false;
  return normalized < todayIsoDate();
}

/** Shown when the event start is before today. */
export const EVENT_DATE_PAST_ERROR = "Event date cannot be in the past.";
/** Shown when the event end is before today. */
export const EVENT_END_DATE_PAST_ERROR = "End date cannot be in the past.";

/** Returns an error message, or null when dates are valid. */
export function validateEventDates(
  eventDate: string,
  eventEndDate?: string | null,
): string | null {
  const start = normalizeIsoDate(eventDate);
  if (!start) return null;

  const today = todayIsoDate();
  if (start < today) return EVENT_DATE_PAST_ERROR;

  const endRaw = eventEndDate?.trim();
  if (!endRaw) return null;

  const end = normalizeIsoDate(endRaw);
  if (!end) return null;
  if (end < today) return EVENT_END_DATE_PAST_ERROR;
  if (end < start) return "End date must be on or after the event date.";

  return null;
}
