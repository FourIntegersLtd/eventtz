import type { components } from "@/lib/api-schema";
import type { WithFields } from "@/lib/apiTypeHelpers";
import api from "@/lib/axios";

/**
 * The API types `overview`, `funnel` and every `*_by_month` series as free-form dicts, so those
 * fields are narrowed by hand here until the pydantic response models name them.
 */
export type VendorAnalytics = WithFields<
  components["schemas"]["VendorAnalyticsResponse"],
  {
    overview: Record<string, number | null>;
    funnel: {
      profile_views: number;
      enquiries: number;
      accepted: number;
      paid: number;
      completed: number;
    };
    enquiries_by_month: { month: string; count: number }[];
    revenue_by_month: { month: string; revenue_gbp: number }[];
    response_time_by_month: { month: string; avg_seconds: number | null }[];
    rating_by_month: { month: string; avg_rating: number | null }[];
  }
>;

export async function fetchVendorAnalytics(days = 90): Promise<VendorAnalytics> {
  const { data } = await api.get<VendorAnalytics>("/api/v1/vendor/analytics", {
    params: { days },
  });
  return data;
}
