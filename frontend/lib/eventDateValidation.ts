/** Local calendar date as `YYYY-MM-DD` — used for event date min/validation. */
export function todayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function normalizeIsoDate(raw: string): string | null {
  const s = raw.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

export function isPastIsoDate(iso: string): boolean {
  const normalized = normalizeIsoDate(iso);
  if (!normalized) return false;
  return normalized < todayIsoDate();
}

export const EVENT_DATE_PAST_ERROR = "Event date cannot be in the past.";
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
