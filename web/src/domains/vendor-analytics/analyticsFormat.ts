/**
 * Display formatters and chart-series helpers for the analytics page.
 *
 * Ported (simplified) from the baseline's `features/vendor/analytics/vendorAnalyticsModel.ts`:
 * money/percent/seconds formatting and turning a monthly array into
 * normalised `{ label, value }` bars a hand-rolled chart can render (`web/`
 * has no charting dependency — see this workstream's hand-off).
 */

/** Whole-pound GBP, e.g. `formatMoneyGbp(1234)` -> "£1,234". */
export function formatMoneyGbp(amount: number | null | undefined): string {
  const value = Number(amount) || 0;
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(value);
}

/** A 0-1 rate as a whole-number percentage, e.g. `0.256` -> "26%". */
export function formatPercent(rate: number | null | undefined): string {
  if (rate == null || Number.isNaN(Number(rate))) return "—";
  return `${Math.round(Number(rate) * 100)}%`;
}

/** Seconds as a compact duration for KPI hints, e.g. `5400` -> "1.5h". */
export function formatSecondsDuration(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(Number(seconds))) return "—";
  const value = Number(seconds);
  if (value < 60) return `${Math.round(value)}s`;
  if (value < 3600) return `${Math.round(value / 60)}m`;
  const hours = value / 3600;
  return `${hours < 10 ? hours.toFixed(1).replace(/\.0$/, "") : Math.round(hours)}h`;
}

export interface ChartBar {
  label: string;
  value: number;
}

/**
 * Turns a `{ month, ...key }` array into chart bars, most recent last.
 * A `null` value (no data that month) becomes `0` so the bar still renders.
 */
export function toMonthSeries<Key extends string>(
  rows: readonly (Record<Key | "month", number | string | null>)[],
  key: Key,
): ChartBar[] {
  return rows.map((row) => ({
    label: monthShortLabel(String(row.month)),
    value: Number(row[key]) || 0,
  }));
}

/** "2026-02" -> "Feb". Falls back to the raw string if it doesn't parse. */
export function monthShortLabel(month: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return month;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  return new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(date);
}

/** The largest value in a series, or 1 if the series is empty/all-zero (keeps bar widths finite). */
export function seriesMax(bars: readonly ChartBar[]): number {
  const highest = Math.max(0, ...bars.map((bar) => bar.value));
  return highest > 0 ? highest : 1;
}
