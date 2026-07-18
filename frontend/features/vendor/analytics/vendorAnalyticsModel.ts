import type { VendorAnalytics } from "@/lib/vendorAnalyticsApi";

export type VendorChartPoint = { date: string; value: number };

export function toVendorMonthSeries(
  rows: { month: string; count?: number; revenue_gbp?: number; avg_seconds?: number | null; avg_rating?: number | null }[],
  key: "count" | "revenue_gbp" | "avg_seconds" | "avg_rating",
  /** Scale for display (e.g. seconds → minutes). */
  scale = 1,
): VendorChartPoint[] {
  return rows.map((r) => {
    const raw = r[key];
    const n = raw == null || Number.isNaN(Number(raw)) ? 0 : Number(raw);
    return {
      date: `${r.month}-01`,
      value: Math.round((n / scale) * 100) / 100,
    };
  });
}

export function vendorOverviewKpis(overview: VendorAnalytics["overview"]) {
  const avgResponse = overview.avg_response_seconds;
  const avgRating = overview.avg_customer_rating;
  return {
    enquiries: Number(overview.enquiries ?? 0) || 0,
    pending: Number(overview.pending_enquiries ?? 0) || 0,
    completed: Number(overview.completed ?? 0) || 0,
    conversion: Number(overview.conversion_rate ?? 0) || 0,
    revenue: Number(overview.total_revenue_gbp ?? 0) || 0,
    avgBooking: Number(overview.avg_booking_value_gbp ?? 0) || 0,
    avgResponseSeconds:
      avgResponse == null || Number.isNaN(Number(avgResponse)) ? null : Number(avgResponse),
    avgRating: avgRating == null || Number.isNaN(Number(avgRating)) ? null : Number(avgRating),
  };
}

export function vendorFunnelDonut(funnel: VendorAnalytics["funnel"]): { name: string; value: number }[] {
  return [
    { name: "Profile views", value: Number(funnel.profile_views) || 0 },
    { name: "Enquiries", value: Number(funnel.enquiries) || 0 },
    { name: "Accepted", value: Number(funnel.accepted) || 0 },
    { name: "Paid", value: Number(funnel.paid) || 0 },
    { name: "Completed", value: Number(funnel.completed) || 0 },
  ];
}

export function formatVendorPct(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${(Number(n) * 100).toFixed(1)}%`;
}

export function formatVendorSeconds(s: number | null | undefined): string {
  if (s == null || Number.isNaN(s)) return "—";
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  return `${(s / 3600).toFixed(1)} h`;
}

export function formatVendorMoney(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `£${Number(n).toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}
