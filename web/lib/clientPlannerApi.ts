import type { components } from "@/lib/api-schema";
import type { WithFields } from "@/lib/apiTypeHelpers";
import api from "@/lib/axios";

/**
 * The vendor card fields below the schema's own are read by the planner screens but the API does
 * not send them today (they render empty); candidates for the pydantic model.
 */
export type PlannerVendorCard = components["schemas"]["PlannerVendorCard"] & {
  services: string[];
  review_average: number | null;
  review_count: number;
  completed_bookings: number;
  avg_response_seconds: number | null;
  conversion_rate: number | null;
  base_city: string | null;
  cover_image_url: string | null;
};

export type PlannerRecommendation = WithFields<
  components["schemas"]["PlanRecommendation"],
  { primary: PlannerVendorCard | null; alternatives: PlannerVendorCard[] }
>;

export type CelebrationBrief = components["schemas"]["CelebrationBrief"];

export type CelebrationPlanResponse = WithFields<
  components["schemas"]["PlanDetailResponse"],
  { recommendations: PlannerRecommendation[] }
>;

export type CelebrationPlanListItem = components["schemas"]["PlanListItem"];

export async function createCelebrationPlan(prompt: string): Promise<CelebrationPlanResponse> {
  const { data } = await api.post<CelebrationPlanResponse>("/api/v1/client/planner/plans", {
    prompt,
  });
  return data;
}

export async function listClientPlans(): Promise<CelebrationPlanListItem[]> {
  const { data } = await api.get<components["schemas"]["PlanListResponse"]>(
    "/api/v1/client/planner/plans",
  );
  return data.plans;
}

export async function fetchCelebrationPlan(planId: string): Promise<CelebrationPlanResponse> {
  const { data } = await api.get<CelebrationPlanResponse>(
    `/api/v1/client/planner/plans/${encodeURIComponent(planId)}`,
  );
  return data;
}

export async function replacePlanRecommendation(
  planId: string,
  needId: string,
  excludeVendorUserId?: string,
): Promise<CelebrationPlanResponse> {
  const { data } = await api.post<CelebrationPlanResponse>(
    `/api/v1/client/planner/plans/${encodeURIComponent(planId)}/items/${encodeURIComponent(needId)}/replace`,
    { exclude_vendor_user_id: excludeVendorUserId || undefined },
  );
  return data;
}

export async function archiveCelebrationPlan(planId: string): Promise<void> {
  await api.post(`/api/v1/client/planner/plans/${encodeURIComponent(planId)}/archive`);
}

export type EnsurePlanEventResponse = components["schemas"]["EnsureEventResponse"];

/** Create or return the client_events row for this plan (before first booking). */
export async function ensurePlanClientEvent(planId: string): Promise<EnsurePlanEventResponse> {
  const { data } = await api.post<EnsurePlanEventResponse>(
    `/api/v1/client/planner/plans/${encodeURIComponent(planId)}/ensure-event`,
  );
  return data;
}
