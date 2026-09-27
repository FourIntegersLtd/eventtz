/**
 * Tests for marketplace search params.
 * Ported from the baseline `marketplaceSearchParams.test.ts`.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildMarketplaceSearchUrl,
  clientSearchContextFromBrowse,
  marketplaceSearchPrefillFromState,
  marketplaceStateFromSearchParams,
  marketplaceStateToExploreQuery,
} from "./marketplaceSearchParams";

describe("marketplaceSearchParams helpers", () => {
  it("round-trips browse filters through URL params", () => {
    const initial = marketplaceStateFromSearchParams(
      new URLSearchParams(
        "q=wedding&types=photography,catering&location=London&dates=2026-09-20,2026-09-21&flexible=1&fromPlanner=plan-123&event_id=evt-1",
      ),
    );
    const roundTrip = marketplaceStateFromSearchParams(
      new URLSearchParams(buildMarketplaceSearchUrl("/client/browse", initial).split("?")[1] ?? ""),
    );
    assert.strictEqual(roundTrip.query, "wedding");
    assert.deepStrictEqual(roundTrip.types, ["photography", "catering"]);
    assert.strictEqual(roundTrip.location, "London");
    assert.deepStrictEqual(roundTrip.dates, []);
    assert.strictEqual(roundTrip.dateFlexible, true);
    assert.strictEqual(roundTrip.fromPlannerPlanId, "plan-123");
    assert.strictEqual(roundTrip.linkedEventId, "evt-1");
  });

  it("builds booking search prefill from marketplace dates", () => {
    const prefill = marketplaceSearchPrefillFromState({
      query: "",
      types: [],
      location: "",
      country: "GB",
      dates: ["2026-09-20", "2026-09-22"],
      dateFlexible: false,
      budgetMin: null,
      budgetMax: null,
      sort: "relevance",
      page: 1,
      vendorIds: [],
      fromPlannerPlanId: null,
      eventName: "",
      venue: "",
      planNotes: "",
      linkedEventId: null,
    });
    assert.deepStrictEqual(prefill, {
      eventDate: "2026-09-20",
      eventEndDate: "2026-09-22",
      datesFlexible: false,
    });
  });

  it("leaves source unset for a plain browse search context", () => {
    const state = marketplaceStateFromSearchParams(new URLSearchParams("location=Leeds"));
    const context = clientSearchContextFromBrowse(state);
    assert.equal(context.location, "Leeds");
    assert.equal(context.country, "GB");
    assert.equal(context.source, undefined);
  });

  it("adds planner attribution to client search context", () => {
    const state = marketplaceStateFromSearchParams(
      new URLSearchParams("fromPlanner=plan-abc&location=Leeds"),
    );
    const context = clientSearchContextFromBrowse(state);
    assert.strictEqual(context.source, "planner");
    assert.strictEqual(context.plannerPlanId, "plan-abc");
    assert.strictEqual(context.location, "Leeds");
  });

  it("maps marketplace state to explore API query", () => {
    const state = marketplaceStateFromSearchParams(
      new URLSearchParams("q=dj&sort=price_asc&budget_min=100"),
    );
    const query = marketplaceStateToExploreQuery(state, {
      vendorIds: ["vendor-1"],
      limit: 6,
      offset: 0,
    });
    assert.deepStrictEqual(query, {
      query: "dj",
      types: undefined,
      location: undefined,
      country: "GB",
      dates: undefined,
      flexible: false,
      budget_min: 100,
      budget_max: undefined,
      sort: "price_asc",
      vendor_ids: "vendor-1",
      limit: 6,
      offset: 0,
    });
  });
});
