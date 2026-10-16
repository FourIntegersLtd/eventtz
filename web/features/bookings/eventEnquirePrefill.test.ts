import { describe, expect, it } from "vitest";
import {
  buildPlannerVendorBookUrl,
  eventPrefillFromCelebrationPlan,
} from "@/features/bookings/eventEnquirePrefill";
import type { CelebrationPlanResponse } from "@/lib/clientPlannerApi";

const basePlan = {
  success: true,
  plan_id: "plan-1",
  status: "active",
  celebration: {
    title: "Sarah's 30th",
    event_type: "birthday",
    location: "The Loft, London",
    guest_count: 80,
    budget_gbp: 5000,
    preferred_date: "2026-09-12",
    summary: "A lively birthday",
  },
  brief: {
    event_type: "birthday",
    event_kind: "standard" as const,
    location: "London",
    related_locations: [],
    guest_count: 80,
    budget_gbp: 5000,
    preferred_date: "2026-09-12",
    preferred_date_invalid: false,
    indoor_outdoor: null,
    cuisine_notes: "Vegetarian options",
    music_notes: null,
    special_requirements: "Outdoor terrace if possible",
    excluded_needs: [],
    currency_assumed_gbp: true,
    raw_prompt: "30th in London",
    unsupported_categories_mentioned: [],
  },
  confidence: { score: 82, reasons: [] },
  budget: {
    lines: [],
    total_estimated_gbp: 4000,
    remaining_budget_gbp: 1000,
    user_budget_gbp: 5000,
    over_budget: false,
    assumptions: [],
  },
  recommendations: [],
  next_steps: [],
  created_at: null,
  updated_at: null,
} satisfies CelebrationPlanResponse;

describe("eventPrefillFromCelebrationPlan", () => {
  it("maps plan title, date, venue, and brief notes", () => {
    const prefill = eventPrefillFromCelebrationPlan(basePlan);
    expect(prefill.eventName).toBe("Sarah's 30th");
    expect(prefill.eventDate).toBe("2026-09-12");
    expect(prefill.venueAddress).toBe("The Loft, London");
    expect(prefill.notes).toContain("80 guests");
    expect(prefill.notes).toContain("Outdoor terrace if possible");
  });
});

describe("buildPlannerVendorBookUrl", () => {
  it("includes event prefill query params", () => {
    const url = buildPlannerVendorBookUrl("vendor-1", basePlan);
    expect(url).toContain("/client/browse/vendor-1");
    expect(url).toContain("eventName=Sarah");
    expect(url).toContain("fromPlanner=plan-1");
    expect(url).toContain("dates=2026-09-12");
  });
});
