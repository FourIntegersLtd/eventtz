/**
 * Book-now URL and event prefill, ported from `eventEnquirePrefill.test.ts`
 * with the cases the planner pages need: event id present and absent, blank
 * fields omitted, and encoding.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  PLAN_DATES,
  PLAN_EVENT_ID,
  PLAN_EVENT_NAME,
  PLAN_FROM_PLANNER,
  PLAN_NOTES,
  PLAN_VENUE,
  buildPlannerVendorBookUrl,
  eventPrefillFromCelebrationPlan,
  todayIsoDate,
  type PlanDetail,
} from "@/domains/client-planner/bookUrl";

const birthdayPlan = {
  success: true,
  plan_id: "plan-1",
  status: "active",
  client_event_id: null,
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
    event_kind: "standard",
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
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
} satisfies PlanDetail;

test("eventPrefillFromCelebrationPlan maps title, date, venue, and brief notes", () => {
  const prefill = eventPrefillFromCelebrationPlan(birthdayPlan);
  assert.equal(prefill.eventName, "Sarah's 30th");
  assert.equal(prefill.eventDate, "2026-09-12");
  assert.equal(prefill.venueAddress, "The Loft, London");
  assert.equal(prefill.notes, "80 guests\nOutdoor terrace if possible\nCuisine: Vegetarian options");
  assert.equal(prefill.eventEndDate, "");
});

test("eventPrefillFromCelebrationPlan uses today when the preferred date is invalid", () => {
  const now = new Date(2026, 8, 27, 15, 0, 0);
  const prefill = eventPrefillFromCelebrationPlan(
    {
      ...birthdayPlan,
      brief: { ...birthdayPlan.brief, preferred_date_invalid: true },
    },
    now,
  );
  assert.equal(prefill.eventDate, todayIsoDate(now));
  assert.equal(prefill.eventDate, "2026-09-27");
});

test("eventPrefillFromCelebrationPlan falls back to My celebration when the title is blank", () => {
  const prefill = eventPrefillFromCelebrationPlan({
    ...birthdayPlan,
    celebration: { ...birthdayPlan.celebration, title: "   ", location: null },
    brief: {
      ...birthdayPlan.brief,
      location: null,
      guest_count: 0,
      special_requirements: null,
      cuisine_notes: null,
      music_notes: "  ",
    },
  });
  assert.equal(prefill.eventName, "My celebration");
  assert.equal(prefill.venueAddress, "");
  assert.equal(prefill.notes, "");
});

test("buildPlannerVendorBookUrl includes event prefill and the event id", () => {
  const url = buildPlannerVendorBookUrl("vendor-1", birthdayPlan, "evt-123");
  assert.equal(
    url,
    "/client/browse/vendor-1?eventName=Sarah%27s+30th&dates=2026-09-12&venue=The+Loft%2C+London&planNotes=80+guests%0AOutdoor+terrace+if+possible%0ACuisine%3A+Vegetarian+options&fromPlanner=plan-1&event_id=evt-123",
  );
  assert.equal(PLAN_EVENT_NAME, "eventName");
  assert.equal(PLAN_VENUE, "venue");
  assert.equal(PLAN_NOTES, "planNotes");
  assert.equal(PLAN_DATES, "dates");
  assert.equal(PLAN_FROM_PLANNER, "fromPlanner");
  assert.equal(PLAN_EVENT_ID, "event_id");
});

test("buildPlannerVendorBookUrl omits event_id when there is no linked event", () => {
  const url = buildPlannerVendorBookUrl("vendor-1", birthdayPlan, null);
  assert.equal(url.includes("event_id="), false);
  assert.equal(url.startsWith("/client/browse/vendor-1?"), true);
  assert.equal(url.includes("fromPlanner=plan-1"), true);
});

test("buildPlannerVendorBookUrl omits blank venue and notes and encodes the vendor id", () => {
  const sparse = {
    ...birthdayPlan,
    plan_id: "plan-1",
    celebration: {
      ...birthdayPlan.celebration,
      title: "A & B",
      location: null,
      preferred_date: "2026-01-02",
    },
    brief: {
      ...birthdayPlan.brief,
      location: "   ",
      guest_count: 0,
      special_requirements: null,
      cuisine_notes: null,
      music_notes: null,
      preferred_date: "2026-01-02",
      preferred_date_invalid: false,
    },
  } satisfies PlanDetail;
  const url = buildPlannerVendorBookUrl("dj & co", sparse, "  ");
  assert.equal(url, "/client/browse/dj%20%26%20co?eventName=A+%26+B&dates=2026-01-02&fromPlanner=plan-1");
  assert.equal(url.includes("venue="), false);
  assert.equal(url.includes("planNotes="), false);
  assert.equal(url.includes("event_id="), false);
});
