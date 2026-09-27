/**
 * Vendor calendar rules for blocked dates and available weekdays.
 * Mirrors the API search rules. The profile shows the dates; the booking modal
 * uses the same check before a request is sent. The server still enforces it.
 */

function normalizeIsoDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length < 10) return null;
  const head = trimmed.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(head)) return null;
  const parsed = Date.parse(`${head}T12:00:00`);
  if (Number.isNaN(parsed)) return null;
  return head;
}

function blockedDatesSet(payload: Record<string, unknown>): Set<string> {
  const raw = payload.blockedDates;
  if (!Array.isArray(raw)) return new Set();
  const blocked = new Set<string>();
  for (const entry of raw) {
    if (typeof entry !== "string") continue;
    const normalized = normalizeIsoDate(entry);
    if (normalized) blocked.add(normalized);
  }
  return blocked;
}

function availableWeekdaysSet(payload: Record<string, unknown>): Set<number> {
  const raw = payload.availableWeekdays;
  if (!Array.isArray(raw)) return new Set();
  const weekdays = new Set<number>();
  for (const entry of raw) {
    if (typeof entry === "boolean" || typeof entry !== "number") continue;
    const day = Math.floor(entry);
    if (day >= 0 && day <= 6) weekdays.add(day);
  }
  return weekdays;
}

/** Inclusive range of YYYY-MM-DD strings. A missing end date is a single day. */
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
  const dates: string[] = [];
  let cursor = new Date(`${start}T12:00:00`);
  const endTime = new Date(`${end}T12:00:00`);
  const maxDays = 400;
  for (let dayIndex = 0; dayIndex < maxDays && cursor <= endTime; dayIndex += 1) {
    const year = cursor.getFullYear();
    const month = String(cursor.getMonth() + 1).padStart(2, "0");
    const day = String(cursor.getDate()).padStart(2, "0");
    dates.push(`${year}-${month}-${day}`);
    cursor = new Date(cursor.getTime() + 86400000);
  }
  return dates;
}

/**
 * True when none of the dates are blocked and each falls on an available weekday.
 * An empty weekday list means every weekday is allowed.
 */
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
    const parsed = Date.parse(`${iso}T12:00:00`);
    if (Number.isNaN(parsed)) continue;
    // Python `date.weekday()` is Mon=0 … Sun=6. JS `getDay()` is Sun=0 … Sat=6.
    const pythonWeekday = (new Date(parsed).getDay() + 6) % 7;
    if (weekdaysOk.size > 0 && !weekdaysOk.has(pythonWeekday)) return false;
  }
  return true;
}

type VendorCalendarPayload = {
  user_id: string;
  profile_form_data?: Record<string, unknown>;
};

/** Vendor user ids whose onboarding calendar rejects the proposed event dates. */
export function vendorUserIdsWithCalendarConflict(
  vendors: VendorCalendarPayload[],
  eventDate: string,
  eventEndDate: string,
): string[] {
  const range = isoDatesInEventRange(eventDate.trim(), eventEndDate.trim() || null);
  if (range.length === 0) return [];
  return vendors
    .filter((vendor) => {
      const payload = vendor.profile_form_data;
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
      return !vendorPayloadAllowsEventDates(payload, range);
    })
    .map((vendor) => vendor.user_id);
}
