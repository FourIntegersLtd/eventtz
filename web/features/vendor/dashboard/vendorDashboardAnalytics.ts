import type { VendorAnalytics } from "@/lib/vendorAnalyticsApi";
import { formatMonthShort, formatVendorMoneyGbp, formatVendorResponseTime } from "@/features/vendor/analytics/vendorAnalyticsModel";

export type DashboardRevenueBar = {
  label: string;
  valueLabel: string;
  heightPx: number;
};

export type VendorDashboardAnalyticsSlice = {
  earnedThisMonthLabel: string;
  revenueBars: DashboardRevenueBar[];
  avgResponseLabel: string;
};

function currentMonthKey(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/** Map vendor analytics API payload into dashboard KPI/chart fields. */
export function vendorDashboardAnalyticsSlice(
  analytics: VendorAnalytics | null,
  now = new Date(),
): VendorDashboardAnalyticsSlice {
  if (!analytics) {
    return {
      earnedThisMonthLabel: "-",
      revenueBars: [],
      avgResponseLabel: "-",
    };
  }

  const monthKey = currentMonthKey(now);
  const earnedRow = analytics.revenue_by_month.find((row) => row.month === monthKey);
  const earned = Number(earnedRow?.revenue_gbp ?? 0) || 0;

  const bars = analytics.revenue_by_month.slice(-6);
  const max = Math.max(1, ...bars.map((row) => Number(row.revenue_gbp) || 0));
  const revenueBars: DashboardRevenueBar[] = bars.map((row) => {
    const value = Number(row.revenue_gbp) || 0;
    return {
      label: formatMonthShort(String(row.month ?? "")),
      valueLabel: formatVendorMoneyGbp(value),
      heightPx: Math.round((value / max) * 150),
    };
  });

  const avgSeconds =
    analytics.overview.avg_response_seconds == null
      ? null
      : Number(analytics.overview.avg_response_seconds);

  return {
    earnedThisMonthLabel: formatVendorMoneyGbp(earned),
    revenueBars,
    avgResponseLabel: formatVendorResponseTime(avgSeconds),
  };
}
