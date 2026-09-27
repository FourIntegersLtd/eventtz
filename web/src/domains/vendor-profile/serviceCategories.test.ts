import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { labelForVendorService } from "@/domains/vendor-profile/serviceCategories";

describe("labelForVendorService", () => {
  it("returns the catalog label for a known key", () => {
    assert.equal(labelForVendorService("dj"), "DJ / music band");
    assert.equal(labelForVendorService("event_planning"), "Event planner");
  });

  it("title-cases an unknown key as a fallback", () => {
    assert.equal(labelForVendorService("balloon_arches"), "Balloon Arches");
  });
});
