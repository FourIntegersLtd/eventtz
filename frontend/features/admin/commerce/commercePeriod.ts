/** Shared trailing date-window presets for admin analytics filters. */

export const ADMIN_PERIOD_OPTIONS = [
  { value: 7, label: "Last 7 days" },
  { value: 30, label: "Last 30 days" },
  { value: 60, label: "Last 60 days" },
  { value: 90, label: "Last 90 days" },
] as const;

/** @deprecated Use ADMIN_PERIOD_OPTIONS */
export const COMMERCE_PERIOD_OPTIONS = ADMIN_PERIOD_OPTIONS;

export type AdminPeriodDays = (typeof ADMIN_PERIOD_OPTIONS)[number]["value"];

/** @deprecated Use AdminPeriodDays */
export type CommercePeriodDays = AdminPeriodDays;

/** Inclusive UTC from/to for a trailing window ending today. */
export function adminPeriodRange(
  periodDays: number,
  now = new Date(),
): { from: string; to: string } {
  const days = Math.max(1, periodDays);
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - (days - 1));
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

/** @deprecated Use adminPeriodRange */
export const commercePeriodRange = adminPeriodRange;

/** Human range (e.g. "19 Jun 2026 – 18 Jul 2026"). */
export function formatCommerceDateRange(fromIso: string, toIso: string): string {
  const fmt = (iso: string) => {
    const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  };
  return `${fmt(fromIso)} – ${fmt(toIso)}`;
}
