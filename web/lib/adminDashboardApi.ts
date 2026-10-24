import type { components } from "@/lib/api-schema";
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

export type AdminMarketplaceAnalytics = components["schemas"]["AdminMarketplaceAnalyticsResponse"];

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
