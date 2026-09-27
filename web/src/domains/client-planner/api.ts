/**
 * The client planner's requests against the platform API.
 *
 * Components never call `platformRequest` directly. Shapes are the generated
 * `schema.d.ts` types. Replace returns one recommendation (the server picks
 * the next untried vendor itself); ensure-event creates or reuses the plan's
 * client event before Book now.
 */
import { platformRequest, type components } from "@/foundation/platform-client";

export type PlanDetail = components["schemas"]["PlanDetailResponse"];
export type PlanListItem = components["schemas"]["PlanListItem"];
export type PlanRecommendation = components["schemas"]["PlanRecommendation"];
export type EnsureEventResponse = components["schemas"]["EnsureEventResponse"];

/** The client's plans, newest first, including archived ones. The view filters to active. */
export async function listClientPlans(): Promise<PlanListItem[]> {
  const response = await platformRequest<components["schemas"]["PlanListResponse"]>(
    "/api/v1/client/planner/plans",
  );
  return response.plans;
}

/** Ask the model for a plan. This call can take a while; the view guards a second submit. */
export async function createCelebrationPlan(prompt: string): Promise<PlanDetail> {
  return platformRequest<PlanDetail>("/api/v1/client/planner/plans", {
    method: "POST",
    body: { prompt } satisfies components["schemas"]["CreatePlanRequest"],
  });
}

/** One plan. Archived plans stay readable; a missing plan is `plan_not_found`. */
export async function fetchCelebrationPlan(planId: string): Promise<PlanDetail> {
  return platformRequest<PlanDetail>(`/api/v1/client/planner/plans/${encodeURIComponent(planId)}`);
}

/**
 * Swap a need's primary vendor for the next candidate.
 *
 * The body is empty on purpose: `ReplaceItemRequest.vendor_user_id` is an
 * unused hint, and the server already knows which vendors this need has shown.
 */
export async function replacePlanRecommendation(
  planId: string,
  needId: string,
): Promise<components["schemas"]["ReplaceItemResponse"]> {
  return platformRequest<components["schemas"]["ReplaceItemResponse"]>(
    `/api/v1/client/planner/plans/${encodeURIComponent(planId)}/items/${encodeURIComponent(needId)}/replace`,
    {
      method: "POST",
      body: {} satisfies components["schemas"]["ReplaceItemRequest"],
    },
  );
}

/** Create or return the client event linked to this plan, before the first booking. */
export async function ensurePlanClientEvent(planId: string): Promise<EnsureEventResponse> {
  return platformRequest<EnsureEventResponse>(
    `/api/v1/client/planner/plans/${encodeURIComponent(planId)}/ensure-event`,
    { method: "POST" },
  );
}
