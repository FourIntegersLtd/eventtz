import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildMarketplaceResultsHeadline,
  expandVendorsForSearchResults,
} from "./marketplaceSearchModel";
import type { ExploreVendorSearchRow } from "./api";

describe("marketplaceSearchModel", () => {
  it("builds a headline for selected types and location", () => {
    const headline = buildMarketplaceResultsHeadline({
      query: "",
      types: ["photography", "catering"],
      location: "London",
      country: "GB",
      dates: [],
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
    assert.strictEqual(headline, "Top matches for Photography & Catering in London");
  });

  it("expands one card per vendor for the first matching selected type", () => {
    const vendor = {
      user_id: "vendor-1",
      matched_services: ["photography", "catering"],
    } as ExploreVendorSearchRow;
    const cards = expandVendorsForSearchResults([vendor], ["catering"]);
    assert.strictEqual(cards.length, 1);
    assert.strictEqual(cards[0]?.highlightService, "catering");
    assert.strictEqual(cards[0]?.cardKey, "vendor-1");
  });
});
