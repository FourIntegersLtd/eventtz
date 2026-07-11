/**
 * Mirrors backend `vendor_search_service` rules for blocked dates + available weekdays.
 * Used for instant client-side feedback; server enforces on submit.
 */

function normalizeIsoDate(raw: string): string | null {
  const s = raw.trim();
  if (s.length < 10) return null;
  const head = s.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(head)) return null;
  const t = Date.parse(`${head}T12:00:00`);
  if (Number.isNaN(t)) return null;
  return head;
}

function blockedDatesSet(payload: Record<string, unknown>): Set<string> {
  const raw = payload.blockedDates;
  if (!Array.isArray(raw)) return new Set();
  const out = new Set<string>();
  for (const x of raw) {
    if (typeof x !== "string") continue;
    const n = normalizeIsoDate(x);
    if (n) out.add(n);
  }
  return out;
}

function availableWeekdaysSet(payload: Record<string, unknown>): Set<number> {
  const raw = payload.availableWeekdays;
  if (!Array.isArray(raw)) return new Set();
  const out = new Set<number>();
  for (const x of raw) {
    if (typeof x === "boolean" || typeof x !== "number") continue;
    const d = Math.floor(x);
    if (d >= 0 && d <= 6) out.add(d);
  }
  return out;
}

/** Inclusive range of YYYY-MM-DD strings. */
export function isoDatesInEventRange(
  eventDateIso: string,
  eventEndIso: string | null | undefined,
): string[] {
  const start = normalizeIsoDate(eventDateIso);
  if (!start) return [];
  if (!eventEndIso?.trim()) return [start];
  const end = normalizeIsoDate(eventEndIso);
  if (!end) return [start];
  if (end < start) return [];
  const out: string[] = [];
  let d = new Date(`${start}T12:00:00`);
  const endT = new Date(`${end}T12:00:00`);
  const maxDays = 400;
  for (let i = 0; i < maxDays && d <= endT; i++) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    out.push(`${y}-${m}-${day}`);
    d = new Date(d.getTime() + 86400000);
  }
  return out;
}

export function vendorPayloadAllowsEventDates(
  payload: Record<string, unknown>,
  isoDates: string[],
): boolean {
  if (isoDates.length === 0) return true;
  const blocked = blockedDatesSet(payload);
  const weekdaysOk = availableWeekdaysSet(payload);
  for (const raw of isoDates) {
    const iso = normalizeIsoDate(raw);
    if (!iso) continue;
    if (blocked.has(iso)) return false;
    const t = Date.parse(`${iso}T12:00:00`);
    if (Number.isNaN(t)) continue;
    // Align with Python `date.weekday()` (Mon=0 … Sun=6) from JS `getDay()` (Sun=0 … Sat=6).
    const pythonWeekday = (new Date(t).getDay() + 6) % 7;
    if (weekdaysOk.size > 0 && !weekdaysOk.has(pythonWeekday)) return false;
  }
  return true;
}
