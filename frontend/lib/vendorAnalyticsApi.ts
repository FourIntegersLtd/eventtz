import api from "@/lib/axios";

export type VendorAnalytics = {
  success: boolean;
  period_days: number;
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
};

export async function fetchVendorAnalytics(days = 90): Promise<VendorAnalytics> {
  const { data } = await api.get<VendorAnalytics>("/api/v1/vendor/analytics", {
    params: { days },
  });
  return data;
}
