import type { components } from "@/lib/api-schema";
import type { WithFields } from "@/lib/apiTypeHelpers";
import api from "@/lib/axios";

export type AdminDashboardSummary = components["schemas"]["AdminDashboardSummary"];

export type AdminDashboardTimeBucket = components["schemas"]["AdminDashboardTimeBucket"];

export type AdminDashboardSignupBucket = components["schemas"]["AdminDashboardSignupBucket"];

export type AdminDashboardMetrics = components["schemas"]["AdminDashboardMetrics"];

export async function fetchAdminDashboardSummary(): Promise<AdminDashboardSummary> {
  const { data } = await api.get<AdminDashboardSummary>("/api/v1/admin/dashboard-summary");
  return data;
}

export async function fetchAdminDashboardMetrics(days = 30): Promise<AdminDashboardMetrics> {
  const { data } = await api.get<AdminDashboardMetrics>("/api/v1/admin/dashboard-metrics", {
    params: { days },
  });
  return data;
}

type AdminMarketplaceCategoryRow = {
  key: string;
  enquiries: number;
  accepted: number;
  paid: number;
  completed: number;
  failed: number;
  conversion_rate: number;
  avg_booking_value_gbp: number;
  revenue_gbp: number;
};

/**
 * The API types every series and the overview of the marketplace analytics as free-form dicts,
 * so those fields are narrowed by hand here until the pydantic response model names them.
 */
export type AdminMarketplaceAnalytics = WithFields<
  components["schemas"]["AdminMarketplaceAnalyticsResponse"],
  {
  overview: Record<string, number | null>;
  enquiries_by_month: { month: string; count: number }[];
  completed_by_month: { month: string; count: number }[];
  by_category: AdminMarketplaceCategoryRow[];
  by_category_chart: AdminMarketplaceCategoryRow[];
  by_location: {
    key: string;
    enquiries: number;
    failed: number;
    conversion_rate: number;
  }[];
  failure_reasons: { reason: string; count: number }[];
  top_vendors: {
    vendor_user_id: string;
    business_name: string;
    enquiries: number;
    completed: number;
    conversion_rate: number;
    avg_response_seconds: number | null;
    revenue_gbp: number;
  }[];
  recruitment_hints: {
    categories: { category: string; enquiries: number; failed: number; message: string }[];
    locations: { location: string; enquiries: number; failed: number; message: string }[];
  };
}
>;

export async function fetchAdminMarketplaceAnalytics(params?: {
  from_date?: string;
  to_date?: string;
  country_code?: string;
  category_offset?: number;
  category_limit?: number;
}): Promise<AdminMarketplaceAnalytics> {
  const { data } = await api.get<AdminMarketplaceAnalytics>(
    "/api/v1/admin/marketplace-analytics",
    { params },
  );
  return data;
}
