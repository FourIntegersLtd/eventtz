import { describe, expect, it } from "vitest";
import {
  buildMarketplaceSearchUrl,
  clientSearchContextFromBrowse,
  marketplaceSearchPrefillFromState,
  marketplaceStateFromSearchParams,
  marketplaceStateToExploreQuery,
} from "@/lib/marketplaceSearchParams";

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
    expect(roundTrip.query).toBe("wedding");
    expect(roundTrip.types).toEqual(["photography", "catering"]);
    expect(roundTrip.location).toBe("London");
    expect(roundTrip.dates).toEqual([]);
    expect(roundTrip.dateFlexible).toBe(true);
    expect(roundTrip.fromPlannerPlanId).toBe("plan-123");
    expect(roundTrip.linkedEventId).toBe("evt-1");
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
    expect(prefill).toEqual({
      eventDate: "2026-09-20",
      eventEndDate: "2026-09-22",
      datesFlexible: false,
    });
  });

  it("adds planner attribution to client search context", () => {
    const state = marketplaceStateFromSearchParams(
      new URLSearchParams("fromPlanner=plan-abc&location=Leeds"),
    );
    const context = clientSearchContextFromBrowse(state);
    expect(context.source).toBe("planner");
    expect(context.plannerPlanId).toBe("plan-abc");
    expect(context.location).toBe("Leeds");
  });

  it("maps marketplace state to explore API query", () => {
    const state = marketplaceStateFromSearchParams(
      new URLSearchParams("q=dj&sort=price_asc&budget_min=100"),
    );
    expect(
      marketplaceStateToExploreQuery(state, {
        vendorIds: ["vendor-1"],
        limit: 6,
        offset: 0,
      }),
    ).toEqual({
      query: "dj",
      types: undefined,
      location: undefined,
      country: "GB",
      dates: [],
      flexible: false,
      budgetMin: 100,
      budgetMax: null,
      sort: "price_asc",
      vendorIds: ["vendor-1"],
      limit: 6,
      offset: 0,
    });
  });
});
