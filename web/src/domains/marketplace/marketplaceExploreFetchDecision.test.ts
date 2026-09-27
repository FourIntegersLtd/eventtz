import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveMarketplaceExploreFetch } from "./marketplaceExploreFetchDecision";

describe("resolveMarketplaceExploreFetch", () => {
  it("favorites with no saved ids does not fetch", () => {
    const decision = resolveMarketplaceExploreFetch({
      savedOnly: true,
      bookmarksReady: true,
      savedVendorIds: new Set(),
      urlVendorIds: [],
    });
    assert.deepStrictEqual(decision, { shouldFetch: false });
  });

  it("favorites with ids fetches only those ids", () => {
    const decision = resolveMarketplaceExploreFetch({
      savedOnly: true,
      bookmarksReady: true,
      savedVendorIds: new Set(["vendor-a", "vendor-b"]),
      urlVendorIds: [],
    });
    assert.deepStrictEqual(decision, {
      shouldFetch: true,
      vendorIds: ["vendor-a", "vendor-b"],
    });
  });

  it("browse with vendor_ids in the URL uses those ids", () => {
    const decision = resolveMarketplaceExploreFetch({
      savedOnly: false,
      bookmarksReady: true,
      savedVendorIds: new Set(),
      urlVendorIds: ["vendor-x"],
    });
    assert.deepStrictEqual(decision, {
      shouldFetch: true,
      vendorIds: ["vendor-x"],
    });
  });

  it("browse with no vendor_ids fetches unfiltered", () => {
    const decision = resolveMarketplaceExploreFetch({
      savedOnly: false,
      bookmarksReady: true,
      savedVendorIds: new Set(["ignored"]),
      urlVendorIds: [],
    });
    assert.deepStrictEqual(decision, {
      shouldFetch: true,
      vendorIds: undefined,
    });
  });
});
