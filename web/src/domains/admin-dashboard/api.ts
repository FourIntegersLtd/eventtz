import { platformRequest } from "@/foundation/platform-client";
import type { components } from "@/foundation/platform-client/schema";

export type AdminDashboardSummary = components["schemas"]["AdminDashboardSummary"];
export type AdminDashboardMetrics = components["schemas"]["AdminDashboardMetrics"];

/** Headline counts across users, vendors, bookings, conversations and reviews. */
export async function fetchAdminDashboardSummary(): Promise<AdminDashboardSummary> {
  return platformRequest<AdminDashboardSummary>("/api/v1/admin/dashboard-summary");
}

/** Bookings-created, bookings-paid and signup charts over a rolling window of days. */
export async function fetchAdminDashboardMetrics(days = 30): Promise<AdminDashboardMetrics> {
  return platformRequest<AdminDashboardMetrics>("/api/v1/admin/dashboard-metrics", { query: { days } });
}
