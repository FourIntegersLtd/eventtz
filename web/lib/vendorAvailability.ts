import { formatDate } from "./dateFormat";

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

const WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

const MAX_BLOCKED_DATES_SHOWN = 8;

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function formatCalendarDay(iso: string, withWeekday: boolean): string {
  return formatDate(new Date(`${iso}T12:00:00Z`), withWeekday ? "longWeekdayDayMonthYear" : "dayMonthYear", "UTC");
}

function pythonWeekday(iso: string): number {
  return (new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7;
}

/** "Saturday", "Monday to Friday", or "every day". `null` when the vendor set no days. */
export function vendorWorkingDaysLabel(payload: Record<string, unknown>): string | null {
  const days = [...availableWeekdaysSet(payload)].sort((first, second) => first - second);
  if (days.length === 0) return null;
  if (days.length === 7) return "every day";
  const names = days.map((day) => WEEKDAY_NAMES[day]);
  const isRun = days.length > 2 && days[days.length - 1] - days[0] === days.length - 1;
  return isRun ? `${names[0]} to ${names[names.length - 1]}` : joinList(names);
}

/** "They take bookings on Saturday." */
export function vendorWorkingDaysSentence(payload: Record<string, unknown>): string | null {
  const label = vendorWorkingDaysLabel(payload);
  if (!label) return null;
  if (label === "every day") return "They take bookings every day.";
  return `They take bookings on ${label}.`;
}

/** Upcoming blocked dates, from `todayIso` inclusive. */
export function vendorBlockedDatesSentence(
  payload: Record<string, unknown>,
  todayIso: string,
): string | null {
  const today = normalizeIsoDate(todayIso);
  const dates = [...blockedDatesSet(payload)]
    .filter((iso) => (today ? iso >= today : true))
    .sort();
  if (dates.length === 0) return null;
  const shown = dates.slice(0, MAX_BLOCKED_DATES_SHOWN).map((iso) => formatCalendarDay(iso, false));
  const extra = dates.length - shown.length;
  const list = extra > 0 ? `${shown.join(", ")} and ${extra} more` : joinList(shown);
  return `Unavailable on ${list}.`;
}

/**
 * Why these dates are outside the vendor calendar, including the days they do take.
 * `null` when the dates are allowed.
 */
export function explainVendorDateConflict(
  payload: Record<string, unknown>,
  isoDates: string[],
): string | null {
  if (vendorPayloadAllowsEventDates(payload, isoDates)) return null;
  const blocked = blockedDatesSet(payload);
  const weekdays = availableWeekdaysSet(payload);
  const problems: string[] = [];
  for (const raw of isoDates) {
    const iso = normalizeIsoDate(raw);
    if (!iso) continue;
    if (blocked.has(iso)) {
      problems.push(`${formatCalendarDay(iso, true)} is marked unavailable`);
      continue;
    }
    if (weekdays.size > 0 && !weekdays.has(pythonWeekday(iso))) {
      problems.push(`${formatCalendarDay(iso, true)} is not a day they take bookings`);
    }
  }
  const schedule = vendorWorkingDaysSentence(payload);
  const detail = problems.slice(0, 3).join(". ");
  if (!detail) return schedule;
  return schedule ? `${detail}. ${schedule}` : `${detail}.`;
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
