import type { components } from "@/lib/api-schema";
import api from "@/lib/axios";

export type VendorAnalytics = components["schemas"]["VendorAnalyticsResponse"];

export async function fetchVendorAnalytics(days = 90): Promise<VendorAnalytics> {
  const { data } = await api.get<VendorAnalytics>("/api/v1/vendor/analytics", {
    params: { days },
  });
  return data;
}
