/** Day, month, and year pieces of an ISO calendar date. Month numbers are 1-12. */

/** Split `YYYY-MM-DD` into numeric parts. A timestamp prefix is trimmed to the date. */
export function isoToParts(iso: string): { year: number; month: number; day: number } | null {
  const normalized = iso.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const [yearPart, monthPart, dayPart] = normalized.split("-").map(Number);
  if (!yearPart || !monthPart || !dayPart) return null;
  return { year: yearPart, month: monthPart, day: dayPart };
}

/** Join numeric parts into `YYYY-MM-DD`, or null when the day does not exist in that month. */
export function partsToIso(year: number, month: number, day: number): string | null {
  if (!year || !month || !day) return null;
  const maxDay = daysInMonth(year, month);
  if (day < 1 || day > maxDay) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** How many days `month` (1-12) has in `year`, including 29 February in a leap year. */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** Short English label for `month` (1-12), or the number when it is out of range. */
export function monthLabel(month: number): string {
  return MONTH_LABELS[month - 1] ?? String(month);
}

/** Months 1-12 still available in `year` once `minIso` has trimmed the earlier ones. */
export function monthOptions(year: number, minIso?: string): number[] {
  if (!year) return Array.from({ length: 12 }, (_, monthIndex) => monthIndex + 1);
  const min = minIso ? isoToParts(minIso) : null;
  const start = min && year === min.year ? min.month : 1;
  const months: number[] = [];
  for (let monthNumber = start; monthNumber <= 12; monthNumber += 1) months.push(monthNumber);
  return months;
}

/** Years from `minIso` (or this year) through `span` years ahead. */
export function yearOptions(minIso?: string, span = 4): number[] {
  const minYear = minIso ? (isoToParts(minIso)?.year ?? new Date().getFullYear()) : new Date().getFullYear();
  const maxYear = new Date().getFullYear() + span;
  const years: number[] = [];
  for (let yearNumber = minYear; yearNumber <= maxYear; yearNumber += 1) years.push(yearNumber);
  return years;
}

/**
 * Days in `month` that are on or after `minIso`.
 * A time suffix on `minIso` is ignored; only the first ten characters count.
 */
export function dayOptions(year: number, month: number, minIso?: string): number[] {
  if (!year || !month) return [];
  const max = daysInMonth(year, month);
  const days: number[] = [];
  for (let dayNumber = 1; dayNumber <= max; dayNumber += 1) {
    const iso = partsToIso(year, month, dayNumber);
    if (minIso && iso && iso < minIso.slice(0, 10)) continue;
    days.push(dayNumber);
  }
  return days;
}
