import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildMarketplaceClearedFilterState,
  marketplaceActiveFilterCount,
} from "./marketplaceFilterState";
import type { MarketplaceSearchState } from "./marketplaceSearchParams";

const baseState: MarketplaceSearchState = {
  query: "wedding dj",
  types: [],
  location: "",
  country: "GB",
  dates: [],
  dateFlexible: false,
  budgetMin: null,
  budgetMax: null,
  sort: "relevance",
  page: 2,
  vendorIds: [],
  fromPlannerPlanId: null,
  eventName: "",
  venue: "",
  planNotes: "",
  linkedEventId: null,
};

describe("marketplaceFilterState", () => {
  it("active count ignores dates-only and flexible-only state", () => {
    assert.strictEqual(
      marketplaceActiveFilterCount({
        ...baseState,
        dates: ["2026-09-20"],
        dateFlexible: false,
      }),
      0,
    );
    assert.strictEqual(
      marketplaceActiveFilterCount({
        ...baseState,
        dates: [],
        dateFlexible: true,
      }),
      0,
    );
  });

  it("active count is 3 with types, location and budget", () => {
    assert.strictEqual(
      marketplaceActiveFilterCount({
        ...baseState,
        types: ["photography"],
        location: "Leeds",
        budgetMin: 100,
        budgetMax: 500,
      }),
      3,
    );
  });

  it("cleared state keeps query and dates, clears the rest, page 1", () => {
    const cleared = buildMarketplaceClearedFilterState({
      ...baseState,
      types: ["catering"],
      location: "Manchester",
      budgetMin: 200,
      budgetMax: 800,
      sort: "price_asc",
      dates: ["2026-10-01"],
      dateFlexible: true,
      page: 4,
    });
    assert.strictEqual(cleared.query, "wedding dj");
    assert.deepStrictEqual(cleared.dates, ["2026-10-01"]);
    assert.strictEqual(cleared.dateFlexible, true);
    assert.deepStrictEqual(cleared.types, []);
    assert.strictEqual(cleared.location, "");
    assert.strictEqual(cleared.budgetMin, null);
    assert.strictEqual(cleared.budgetMax, null);
    assert.strictEqual(cleared.sort, "relevance");
    assert.strictEqual(cleared.page, 1);
  });
});
