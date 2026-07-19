import api from "@/lib/axios";

export type PlannerVendorCard = {
  user_id: string;
  business_name: string;
  services: string[];
  review_average: number | null;
  review_count: number;
  completed_bookings: number;
  avg_response_seconds: number | null;
  conversion_rate: number | null;
  min_list_price_gbp: number | null;
  base_city: string | null;
  cover_image_url: string | null;
  unavailable: boolean;
  price_on_request: boolean;
};

export type PlannerRecommendation = {
  need_id: string;
  label: string;
  service_key: string;
  optional: boolean;
  primary: PlannerVendorCard | null;
  alternatives: PlannerVendorCard[];
  estimated_cost_gbp: number | null;
  why_selected: string;
  empty_reason: string | null;
};

export type CelebrationBrief = {
  event_type: string | null;
  event_kind: "funeral" | "corporate" | "standard";
  location: string | null;
  related_locations: string[];
  guest_count: number | null;
  budget_gbp: number | null;
  preferred_date: string | null;
  preferred_date_invalid: boolean;
  indoor_outdoor: string | null;
  cuisine_notes: string | null;
  music_notes: string | null;
  special_requirements: string | null;
  excluded_needs: string[];
  currency_assumed_gbp: boolean;
  raw_prompt: string;
  unsupported_categories_mentioned: string[];
};

export type CelebrationPlanResponse = {
  success: boolean;
  plan_id: string;
  status: string;
  celebration: {
    title: string;
    event_type: string | null;
    location: string | null;
    guest_count: number | null;
    budget_gbp: number | null;
    preferred_date: string | null;
    summary: string;
  };
  brief: CelebrationBrief;
  confidence: { score: number; reasons: string[] };
  budget: {
    lines: {
      need_id: string;
      label: string;
      amount_gbp: number;
      allocated_gbp: number | null;
      assumption: string | null;
    }[];
    total_estimated_gbp: number | null;
    remaining_budget_gbp: number | null;
    user_budget_gbp: number | null;
    over_budget: boolean;
    assumptions: string[];
  };
  recommendations: PlannerRecommendation[];
  next_steps: string[];
  created_at: string | null;
  updated_at: string | null;
};

export type CelebrationPlanListItem = {
  plan_id: string;
  title: string;
  event_type: string | null;
  location: string | null;
  confidence_score: number | null;
  status: string;
  created_at: string | null;
  updated_at: string | null;
};

export async function createCelebrationPlan(prompt: string): Promise<CelebrationPlanResponse> {
  const { data } = await api.post<CelebrationPlanResponse>("/api/v1/client/planner/plans", {
    prompt,
  });
  return data;
}

export async function listCelebrationPlans(): Promise<CelebrationPlanListItem[]> {
  const { data } = await api.get<{ success: boolean; plans: CelebrationPlanListItem[] }>(
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
