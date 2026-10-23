import type { VendorAnalytics } from "@/lib/vendorAnalyticsApi";
import type { AdminPeriodDays } from "@/lib/commercePeriod";
import { formatDate } from "@/lib/dateFormat";

export const VENDOR_ANALYTICS_PERIOD_OPTIONS: { value: AdminPeriodDays; label: string }[] = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
];

export type VendorAnalyticsKpis = {
  profileViews: number;
  enquiries: number;
  conversionRate: number;
  bookedValueGbp: number;
  completed: number;
  avgResponseSeconds: number | null;
};

export function vendorAnalyticsKpis(data: VendorAnalytics): VendorAnalyticsKpis {
  const overview = data.overview;
  return {
    profileViews: Number(overview.profile_views ?? data.funnel.profile_views ?? 0) || 0,
    enquiries: Number(overview.enquiries ?? data.funnel.enquiries ?? 0) || 0,
    conversionRate: Number(overview.conversion_rate ?? 0) || 0,
    bookedValueGbp: Number(overview.total_revenue_gbp ?? 0) || 0,
    completed: Number(overview.completed ?? data.funnel.completed ?? 0) || 0,
    avgResponseSeconds:
      overview.avg_response_seconds == null ? null : Number(overview.avg_response_seconds),
  };
}

export type VendorAnalyticsBarPoint = {
  monthKey: string;
  label: string;
  enquiries: number;
  barHeightPx: number;
};

/** Monthly enquiry bars for the ez bar chart (last six months in the series). */
export function vendorEnquiryBarSeries(data: VendorAnalytics): VendorAnalyticsBarPoint[] {
  const rows = data.enquiries_by_month.slice(-6);
  const max = Math.max(1, ...rows.map((row) => Number(row.count) || 0));
  return rows.map((row) => {
    const count = Number(row.count) || 0;
    const monthKey = String(row.month ?? "");
    const label = formatMonthShort(monthKey);
    return {
      monthKey,
      label,
      enquiries: count,
      barHeightPx: Math.round((count / max) * 150),
    };
  });
}

export function formatMonthShort(monthKey: string): string {
  if (!monthKey || monthKey.length < 7) return monthKey;
  const d = new Date(`${monthKey.slice(0, 7)}-01T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return monthKey;
  return formatDate(d, "monthShort", "UTC");
}

export function formatVendorConversion(rate: number): string {
  if (!Number.isFinite(rate) || rate <= 0) return "0%";
  return `${(rate * 100).toFixed(1)}%`;
}

export function formatVendorResponseTime(seconds: number | null): string {
  if (seconds == null || Number.isNaN(seconds)) return "-";
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))} min`;
  return `${(seconds / 3600).toFixed(1)} h`;
}

export type VendorFunnelRow = { label: string; value: number };

export function vendorFunnelRows(data: VendorAnalytics): VendorFunnelRow[] {
  const funnel = data.funnel;
  return [
    { label: "Profile views", value: Number(funnel.profile_views ?? 0) || 0 },
    { label: "Enquiries received", value: Number(funnel.enquiries ?? 0) || 0 },
    { label: "Quotes accepted", value: Number(funnel.accepted ?? 0) || 0 },
    { label: "Paid bookings", value: Number(funnel.paid ?? 0) || 0 },
    { label: "Completed", value: Number(funnel.completed ?? 0) || 0 },
  ];
}

export function vendorEnquiryToBookingRate(data: VendorAnalytics): string {
  const enquiries = Number(data.funnel.enquiries ?? 0) || 0;
  const completed = Number(data.funnel.completed ?? 0) || 0;
  if (enquiries === 0) return "0%";
  return `${((completed / enquiries) * 100).toFixed(1)}%`;
}

export type VendorChartPoint = { date: string; value: number };

/** Month rows shaped for the shared bar and area charts. */
export function toVendorMonthSeries(
  rows: {
    month: string;
    count?: number;
    revenue_gbp?: number;
    avg_seconds?: number | null;
    avg_rating?: number | null;
  }[],
  key: "count" | "revenue_gbp" | "avg_seconds" | "avg_rating",
  scale = 1,
): VendorChartPoint[] {
  return rows.map((row) => {
    const raw = row[key];
    const amount = raw == null || Number.isNaN(Number(raw)) ? 0 : Number(raw);
    return {
      date: `${row.month}-01`,
      value: Math.round((amount / scale) * 100) / 100,
    };
  });
}

export function vendorOverviewKpis(overview: VendorAnalytics["overview"]) {
  const avgResponse = overview.avg_response_seconds;
  return {
    enquiries: Number(overview.enquiries ?? 0) || 0,
    pending: Number(overview.pending_enquiries ?? 0) || 0,
    completed: Number(overview.completed ?? 0) || 0,
    conversion: Number(overview.conversion_rate ?? 0) || 0,
    revenue: Number(overview.total_revenue_gbp ?? 0) || 0,
    avgResponseSeconds:
      avgResponse == null || Number.isNaN(Number(avgResponse)) ? null : Number(avgResponse),
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

export function formatVendorPct(rate: number | null | undefined): string {
  if (rate == null || Number.isNaN(rate)) return "-";
  return `${(Number(rate) * 100).toFixed(1)}%`;
}

export function formatVendorSeconds(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return "-";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  return `${(seconds / 3600).toFixed(1)} h`;
}

