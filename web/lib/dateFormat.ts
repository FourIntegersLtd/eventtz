/**
 * The only place dates and times are formatted for display (guarded by `lib/formatGuard.test.ts`).
 * Always `en-GB`. Pass a named style from `DATE_STYLES`; callers keep their own parsing and
 * fallback text for a missing or invalid value.
 */

/** Every date and time pattern the app shows, by name. */
export const DATE_STYLES = {
  /** "12 Jul" */
  dayMonth: { day: "numeric", month: "short" },
  /** "12 Jul 2026" */
  dayMonthYear: { day: "numeric", month: "short", year: "numeric" },
  /** "12 July 2026" */
  dayLongMonthYear: { day: "numeric", month: "long", year: "numeric" },
  /** "Jul 2026" */
  monthYear: { month: "short", year: "numeric" },
  /** "July 2026" */
  longMonthYear: { month: "long", year: "numeric" },
  /** "Jul" */
  monthShort: { month: "short" },
  /** "Sun, 12 Jul" */
  weekdayDayMonth: { weekday: "short", day: "numeric", month: "short" },
  /** "Sun, 12 Jul 2026" */
  weekdayDayMonthYear: { weekday: "short", day: "numeric", month: "short", year: "numeric" },
  /** "Sunday 12 Jul 2026" */
  longWeekdayDayMonthYear: { weekday: "long", day: "numeric", month: "short", year: "numeric" },
  /** "Sunday 12 July" */
  longWeekdayDayLongMonth: { weekday: "long", day: "numeric", month: "long" },
  /** "12 Jul 2026" through the medium date style */
  dateMedium: { dateStyle: "medium" },
  /** "12 Jul 2026, 14:03" */
  dateTimeMedium: { dateStyle: "medium", timeStyle: "short" },
  /** "12/07/2026, 14:03" */
  dateTimeShort: { dateStyle: "short", timeStyle: "short" },
  /** "12 Jul, 14:03" */
  dayMonthTime: { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" },
  /** "14:03" */
  time: { hour: "2-digit", minute: "2-digit" },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>;

export type DateStyle = keyof typeof DATE_STYLES;

/** One formatter per (style, timeZone): building an `Intl.DateTimeFormat` is the slow part. */
const formatterCache = new Map<string, Intl.DateTimeFormat>();

/**
 * Formats a valid `Date` in the given style. `timeZone: "UTC"` keeps a date-only value (built
 * from `...T12:00:00Z`) on its own day for every visitor; omit it to show the visitor's local time.
 */
export function formatDate(date: Date, style: DateStyle, timeZone?: "UTC"): string {
  // Intl throws on an invalid date; the old toLocale* calls returned this text, so a bad value never crashed a screen.
  if (Number.isNaN(date.getTime())) return "Invalid Date";
  const cacheKey = `${style}|${timeZone ?? ""}`;
  let formatter = formatterCache.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-GB", { ...DATE_STYLES[style], ...(timeZone ? { timeZone } : {}) });
    formatterCache.set(cacheKey, formatter);
  }
  return formatter.format(date);
}

/** "12/07/2026, 14:03:09": the default numeric date and time, used by the dispute lists. */
export function formatDateTimeSeconds(date: Date): string {
  return date.toLocaleString("en-GB");
}

/** Formats a `YYYY-MM-DD` event date as e.g. "Sat, 12 Jul 2026". Noon avoids off-by-one-day DST issues. */
export function formatEventDate(iso: string): string {
  if (!iso || iso.length < 10) return iso;
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return formatDate(d, "weekdayDayMonthYear");
}

/** Compact date label for feed rows: "Today", "Tomorrow", or e.g. "12 Jul". */
export function shortDateLabel(iso: string | null | undefined): string {
  if (!iso || iso.length < 10) return "";
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const diffDays = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  return formatDate(d, "dayMonth");
}

/** Formats a full ISO timestamp as e.g. "12 Jul 2026, 14:03". */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return formatDate(d, "dateTimeMedium");
}
