/**
 * Toggling a vendor twice removes it. Clear leaves nothing selected.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  clearSelectedVendors,
  listSelectedVendors,
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
