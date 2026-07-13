/** Split `YYYY-MM-DD` into numeric parts (month is 1–12). */
export function isoToParts(iso: string): { year: number; month: number; day: number } | null {
  const normalized = iso.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const [y, m, d] = normalized.split("-").map(Number);
  if (!y || !m || !d) return null;
  return { year: y, month: m, day: d };
}

export function partsToIso(year: number, month: number, day: number): string | null {
  if (!year || !month || !day) return null;
  const maxDay = daysInMonth(year, month);
  if (day < 1 || day > maxDay) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

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

export function monthLabel(month: number): string {
  return MONTH_LABELS[month - 1] ?? String(month);
}

export function monthOptions(year: number, minIso?: string): number[] {
  if (!year) return Array.from({ length: 12 }, (_, i) => i + 1);
  const min = minIso ? isoToParts(minIso) : null;
  const start = min && year === min.year ? min.month : 1;
  const months: number[] = [];
  for (let m = start; m <= 12; m += 1) months.push(m);
  return months;
}

export function yearOptions(minIso?: string, span = 4): number[] {
  const minYear = minIso ? (isoToParts(minIso)?.year ?? new Date().getFullYear()) : new Date().getFullYear();
  const maxYear = new Date().getFullYear() + span;
  const years: number[] = [];
  for (let y = minYear; y <= maxYear; y += 1) years.push(y);
  return years;
}

export function dayOptions(year: number, month: number, minIso?: string): number[] {
  if (!year || !month) return [];
  const max = daysInMonth(year, month);
  const days: number[] = [];
  for (let d = 1; d <= max; d += 1) {
    const iso = partsToIso(year, month, d);
    if (minIso && iso && iso < minIso.slice(0, 10)) continue;
    days.push(d);
  }
  return days;
}
