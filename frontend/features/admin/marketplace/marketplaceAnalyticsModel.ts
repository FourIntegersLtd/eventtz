import type { AdminMarketplaceAnalytics } from "@/lib/adminDashboardApi";

export type MarketplaceChartPoint = { date: string; value: number };
export type MarketplaceCategoryBar = { label: string; value: number };

export {
  ADMIN_PERIOD_OPTIONS as MARKETPLACE_PERIOD_OPTIONS,
  type AdminPeriodDays as MarketplacePeriodDays,
} from "@/features/admin/commerce/commercePeriod";

/** Chart series from monthly enquiry counts (empty analytics → empty series). */
export function toMarketplaceDemandSeries(
  rows: AdminMarketplaceAnalytics["enquiries_by_month"],
): MarketplaceChartPoint[] {
  return rows.map((r) => ({
    date: `${r.month}-01`,
    value: Number(r.count) || 0,
  }));
}

/** Chart series from monthly completed counts. */
export function toMarketplaceCompletedSeries(
  rows: AdminMarketplaceAnalytics["completed_by_month"],
): MarketplaceChartPoint[] {
  return rows.map((r) => ({
    date: `${r.month}-01`,
    value: Number(r.count) || 0,
  }));
}

/** Horizontal bar rows for category performance (raw labels — never date-format). */
export function toMarketplaceCategoryBars(
  rows: AdminMarketplaceAnalytics["by_category"],
  limit = 6,
): MarketplaceCategoryBar[] {
  return rows.slice(0, limit).map((r) => ({
    label: r.key,
    value: Number(r.enquiries) || 0,
  }));
}

/** KPI numbers from overview with safe defaults for empty/local analytics. */
export function marketplaceOverviewKpis(overview: AdminMarketplaceAnalytics["overview"]): {
  enquiries: number;
  completed: number;
  overallConversion: number;
  unfulfilled: number;
  vendorsActive: number;
  avgBookingValue: number;
  avgResponseSeconds: number | null;
  avgRating: number | null;
  replyWithin1h: number | null;
  replyWithin6h: number | null;
  replyWithin24h: number | null;
  vendorReminders: number;
  clientNudges: number;
  multiBatches: number;
} {
  const avgResponse = overview.avg_vendor_response_seconds;
  const avgRating = overview.avg_customer_rating;
  const rateOrNull = (v: number | null | undefined) =>
    v == null || Number.isNaN(Number(v)) ? null : Number(v);
  return {
    enquiries: Number(overview.enquiries ?? 0) || 0,
    completed: Number(overview.completed ?? 0) || 0,
    overallConversion: Number(overview.overall_conversion_rate ?? 0) || 0,
    unfulfilled: Number(overview.unfulfilled ?? 0) || 0,
    vendorsActive: Number(overview.vendors_active ?? 0) || 0,
    avgBookingValue: Number(overview.avg_booking_value_gbp ?? 0) || 0,
    avgResponseSeconds:
      avgResponse == null || Number.isNaN(Number(avgResponse)) ? null : Number(avgResponse),
    avgRating: avgRating == null || Number.isNaN(Number(avgRating)) ? null : Number(avgRating),
    replyWithin1h: rateOrNull(overview.reply_within_1h_rate as number | null | undefined),
    replyWithin6h: rateOrNull(overview.reply_within_6h_rate as number | null | undefined),
    replyWithin24h: rateOrNull(overview.reply_within_24h_rate as number | null | undefined),
    vendorReminders: Number(overview.enquiry_vendor_reminders ?? 0) || 0,
    clientNudges: Number(overview.enquiry_client_nudges ?? 0) || 0,
    multiBatches: Number(overview.enquiry_multi_batches ?? 0) || 0,
  };
}

export function formatMarketplacePct(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${(Number(n) * 100).toFixed(1)}%`;
}

/** Quiet footer lines for the marketplace overview (secondary KPIs, not hero cards). */
export function marketplaceSecondaryMeta(
  kpis: ReturnType<typeof marketplaceOverviewKpis>,
): string[] {
  const lines: string[] = [];
  if (kpis.replyWithin1h != null) {
    lines.push(
      `Reply <1h ${formatMarketplacePct(kpis.replyWithin1h)} · <6h ${formatMarketplacePct(kpis.replyWithin6h)} · <24h ${formatMarketplacePct(kpis.replyWithin24h)}`,
    );
  }
  if (kpis.vendorReminders > 0 || kpis.clientNudges > 0) {
    lines.push(
      `${kpis.vendorReminders} vendor nudges · ${kpis.clientNudges} client nudges`,
    );
  }
  if (kpis.multiBatches > 0) {
    lines.push(`${kpis.multiBatches} multi-vendor batches`);
  }
  return lines;
}

export function formatMarketplaceSeconds(s: number | null | undefined): string {
  if (s == null || Number.isNaN(s)) return "—";
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  return `${(s / 3600).toFixed(1)} h`;
}

export function formatMarketplaceMoney(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `£${Number(n).toFixed(0)}`;
}
