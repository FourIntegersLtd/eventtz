import { describe, expect, it } from "vitest";
import { applyPackageCoachSuggestions } from "./packageCoachApply";
import type { VendorPackageItem } from "./types";

const basePkg = (overrides: Partial<VendorPackageItem> = {}): VendorPackageItem => ({
  id: "pkg-1",
  title: "Gold package",
  details: "Basic details here that are long enough for validation purposes.",
  price: "500",
  duration: "2 hr",
  useDefaultTravelPackage: true,
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
    expect(updatedIds).toEqual(["pkg-1"]);
    expect(next[0]?.title).toBe("Chair Hire – 50 pack");
    expect(next[0]?.details).toContain("50 white folding chairs");
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
    expect(updatedIds).toEqual(["x"]);
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
    expect(updatedIds).toEqual([]);
    expect(next[0]?.title).toBe("Gold package");
  });
});
