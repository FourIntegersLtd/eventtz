import { platformRequest } from "@/foundation/platform-client";

/**
 * The vendor analytics response, typed to the shapes the API actually sends.
 *
 * `openapi.json` generates `VendorAnalyticsResponse`'s nested fields as
 * `Record<string, unknown>` (a FastAPI `dict` return type carries no more
 * structure than that), so this restates the real shape — the same fields
 * the baseline's `lib/vendorAnalyticsApi.ts` declared — for the view to use
 * without `unknown` casts scattered through it.
 */
export interface VendorAnalytics {
  success: boolean;
  period_days: number;
  overview: {
    enquiries?: number;
    pending?: number;
    accepted?: number;
    completed?: number;
    revenue_gbp?: number;
    conversion_rate?: number | null;
    avg_response_seconds?: number | null;
  };
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

/** Fetch the vendor's analytics for the trailing `days` days (7-365, default 90). */
export function fetchVendorAnalytics(days = 90): Promise<VendorAnalytics> {
  return platformRequest<VendorAnalytics>("/api/v1/vendor/analytics", { query: { days } });
}
