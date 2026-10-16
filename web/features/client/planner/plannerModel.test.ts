import { describe, expect, it } from "vitest";
import { buildPlannerBrowseUrl } from "@/features/client/planner/plannerModel";
import type { CelebrationPlanResponse } from "@/lib/clientPlannerApi";

const plan = {
  success: true,
  plan_id: "plan-abc",
  status: "active",
  celebration: {
    title: "Sarah's wedding",
    event_type: "wedding",
    location: "London",
    guest_count: 100,
    budget_gbp: 10000,
    preferred_date: "2026-09-20",
    summary: "A wedding",
  },
  brief: {
    event_type: "wedding",
    event_kind: "standard" as const,
    location: "London",
    related_locations: [],
    guest_count: 100,
    budget_gbp: 10000,
    preferred_date: "2026-09-20",
    preferred_date_invalid: false,
    indoor_outdoor: null,
    cuisine_notes: null,
    music_notes: null,
    special_requirements: null,
    excluded_needs: [],
    currency_assumed_gbp: true,
    raw_prompt: "Plan my wedding in London",
    unsupported_categories_mentioned: [],
  },
  confidence: { score: 90, reasons: [] },
  budget: {
    lines: [],
    total_estimated_gbp: 8000,
    remaining_budget_gbp: 2000,
    user_budget_gbp: 10000,
    over_budget: false,
    assumptions: [],
  },
  recommendations: [
    {
      need_id: "dj",
      label: "DJ",
      service_key: "dj",
      optional: false,
      primary: {
        user_id: "vendor-dj",
        business_name: "DJ Co",
        services: ["dj"],
        review_average: 4.8,
        review_count: 12,
        completed_bookings: 5,
        avg_response_seconds: 3600,
        conversion_rate: 0.5,
        min_list_price_gbp: 500,
        base_city: "London",
        cover_image_url: null,
        unavailable: false,
        price_on_request: false,
      },
      alternatives: [],
      estimated_cost_gbp: 500,
      why_selected: "Great fit",
      empty_reason: null,
    },
  ],
  next_steps: [],
  created_at: null,
  updated_at: null,
} satisfies CelebrationPlanResponse;

describe("buildPlannerBrowseUrl", () => {
  it("links to browse with prompt, vendor ids, event id, and event prefill", () => {
    const url = buildPlannerBrowseUrl(plan, "evt-123");
    expect(url).toContain("/client/browse?");
    expect(url).toContain("fromPlanner=plan-abc");
    expect(url).toContain("event_id=evt-123");
    expect(url).toContain("vendor_ids=vendor-dj");
    expect(url).toContain("eventName=Sarah");
    expect(url).toContain("dates=2026-09-20");
    expect(url).toContain("location=London");
  });
});
