/**
 * Port of `frontend/features/client/planner/plannerModel.test.ts`, plus the
 * active-plan filter. Asserts the marketplace handoff URL exactly.
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { PlanDetail, PlanListItem } from "@/domains/client-planner/plannerModel";
import {
  activePlans,
  buildPlannerBrowseUrl,
  planWithReplacedRecommendation,
} from "@/domains/client-planner/plannerModel";

const weddingPlan = {
  success: true,
  plan_id: "plan-abc",
  status: "active",
  client_event_id: null,
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
    event_kind: "standard",
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
        city: "London",
        min_list_price_gbp: 500,
        unavailable: false,
        price_on_request: false,
      },
      alternatives: [],
      estimated_cost_gbp: 500,
      why_selected: "Great fit",
      empty_reason: null,
    },
  ],
  created_at: "2026-09-01T00:00:00Z",
  next_steps: [],
  updated_at: "2026-09-01T00:00:00Z",
} satisfies PlanDetail;

test("buildPlannerBrowseUrl links to browse with prompt, vendor ids, event id, and event prefill", () => {
  const url = buildPlannerBrowseUrl(weddingPlan, "evt-123");
  assert.equal(
    url,
    "/client/browse?q=Plan+my+wedding+in+London&location=London&dates=2026-09-20&vendor_ids=vendor-dj&fromPlanner=plan-abc&eventName=Sarah%27s+wedding&venue=London&planNotes=100+guests&event_id=evt-123",
  );
});

test("activePlans keeps only status active", () => {
  const plans: PlanListItem[] = [
    {
      plan_id: "live",
      title: "Live",
      event_type: "wedding",
      location: "London",
      confidence_score: 80,
      status: "active",
      created_at: "2026-09-01T00:00:00Z",
      updated_at: "2026-09-01T00:00:00Z",
    },
    {
      plan_id: "old",
      title: "Old",
      event_type: "wedding",
      location: null,
      confidence_score: null,
      status: "archived",
      created_at: "2026-08-01T00:00:00Z",
      updated_at: "2026-08-01T00:00:00Z",
    },
  ];
  assert.deepEqual(
    activePlans(plans).map((plan) => plan.plan_id),
    ["live"],
  );
});

test("planWithReplacedRecommendation swaps only the matching need", () => {
  const current = weddingPlan.recommendations[0];
  if (!current) throw new Error("fixture missing the DJ recommendation");
  const replacement = {
    need_id: current.need_id,
    label: current.label,
    service_key: current.service_key,
    optional: current.optional,
    primary: {
      user_id: "vendor-band",
      business_name: "Band Co",
      city: "London",
      min_list_price_gbp: 800,
      unavailable: false,
      price_on_request: false,
    },
    alternatives: current.alternatives,
    estimated_cost_gbp: current.estimated_cost_gbp,
    why_selected: "Next best",
    empty_reason: current.empty_reason,
  };
  const updated = planWithReplacedRecommendation(weddingPlan, replacement);
  assert.equal(updated.recommendations[0]?.primary?.user_id, "vendor-band");
  assert.equal(updated.plan_id, "plan-abc");
});
