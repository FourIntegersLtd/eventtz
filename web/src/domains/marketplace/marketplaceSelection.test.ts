/**
 * Toggling a vendor twice removes it. Clear leaves nothing selected.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  clearSelectedVendors,
  listSelectedVendors,
  plannerPreselection,
  toggleSelectedVendor,
} from "./marketplaceSelection";

const vendor = { user_id: "vendor-1", businessName: "North Catering" };

describe("marketplace selection", () => {
  it("removes a vendor when it is toggled twice", () => {
    const once = toggleSelectedVendor({}, vendor);
    assert.deepEqual(listSelectedVendors(once), [vendor]);
    const twice = toggleSelectedVendor(once, vendor);
    assert.deepEqual(twice, {});
    assert.deepEqual(listSelectedVendors(twice), []);
  });

  it("preselects planner ids found in the vendor list and in sections", () => {
    const caterer = { user_id: "vendor-caterer", businessName: "Harbour Catering" };
    const dj = { user_id: "vendor-dj", businessName: "Night DJ" };
    const florist = { user_id: "vendor-florist", businessName: "Bloom" };
    const selected = plannerPreselection(
      ["vendor-caterer", "vendor-dj", "vendor-missing"],
      [caterer, florist],
      [{ vendors: [dj] }],
    );
    assert.deepEqual(selected, {
      "vendor-caterer": caterer,
      "vendor-dj": dj,
    });
  });

  it("returns nothing when browse was not opened from a planner with vendor ids", () => {
    const caterer = { user_id: "vendor-caterer", businessName: "Harbour Catering" };
    assert.deepEqual(plannerPreselection([], [caterer], [{ vendors: [caterer] }]), {});
  });

  it("clears every selected vendor", () => {
    const selected = toggleSelectedVendor(
      toggleSelectedVendor({}, vendor),
      { user_id: "vendor-2", businessName: "South Sound" },
    );
    assert.equal(listSelectedVendors(selected).length, 2);
    const cleared = clearSelectedVendors();
    assert.deepEqual(cleared, {});
    assert.deepEqual(listSelectedVendors(cleared), []);
  });
});
