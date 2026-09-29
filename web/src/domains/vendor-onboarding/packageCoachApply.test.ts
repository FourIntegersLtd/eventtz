/** packageCoachApply.test for the vendor onboarding wizard. */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyPackageCoachSuggestions } from "./packageCoachApply";
import type { VendorPackageItem } from "./types";

const basePkg = (overrides: Partial<VendorPackageItem> = {}): VendorPackageItem => ({
  id: "pkg-1",
  title: "Gold package",
  details: "Basic details here that are long enough for validation purposes.",
  price: "500",
  duration: "2 hr",
  useDefaultTravelPackage: true,
  pricingMode: "fixed",
  unitLabel: "",
  minQuantity: "",
  maxQuantity: "",
  ...overrides,
});

describe("applyPackageCoachSuggestions", () => {
  it("applies suggested fields matched by package id", () => {
    const packages = [basePkg()];
    const { packages: next, updatedIds } = applyPackageCoachSuggestions(packages, [
      {
        package_id: "pkg-1",
        package_title: "Gold package",
        items: [],
        suggested_title: "Chair Hire – 50 pack",
        suggested_details:
          "50 white folding chairs, 3-day hire, delivery and collection within 10 miles.",
      },
    ]);
    assert.deepEqual(updatedIds, ["pkg-1"]);
    assert.equal(next[0]?.title, "Chair Hire – 50 pack");
    assert.ok(next[0]?.details.includes("50 white folding chairs"));
  });

  it("matches by title when id missing", () => {
    const packages = [basePkg({ id: "x", title: "Silver Package" })];
    const { updatedIds } = applyPackageCoachSuggestions(packages, [
      {
        package_title: "Silver Package",
        items: [],
        suggested_duration: "2 hr on-site",
      },
    ]);
    assert.deepEqual(updatedIds, ["x"]);
  });

  it("skips near-duplicate suggestions", () => {
    const packages = [
      basePkg({
        title: "Gold package",
        details: "Chairs and tables for events with delivery.",
      }),
    ];
    const { packages: next, updatedIds } = applyPackageCoachSuggestions(packages, [
      {
        package_id: "pkg-1",
        package_title: "Gold package",
        items: [],
        suggested_title: "Chairs",
        suggested_details: "Chairs and tables for events with delivery included.",
      },
    ]);
    assert.deepEqual(updatedIds, []);
    assert.equal(next[0]?.title, "Gold package");
  });
});
