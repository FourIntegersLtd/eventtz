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
} {
  const avgResponse = overview.avg_vendor_response_seconds;
  const avgRating = overview.avg_customer_rating;
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
  };
}

export function formatMarketplacePct(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${(Number(n) * 100).toFixed(1)}%`;
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
