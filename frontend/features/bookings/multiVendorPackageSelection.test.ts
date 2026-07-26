import { describe, expect, it } from "vitest";
import {
  defaultOptionIdForVendor,
  initialOptionSelections,
} from "@/features/bookings/multiVendorPackageSelection";
import type { ExploreVendorSearchRow } from "@/lib/clientExploreApi";

function vendor(
  userId: string,
  packages: { id: string; title: string; price: string }[],
): ExploreVendorSearchRow {
  return {
    user_id: userId,
    payload: {
      businessName: `Vendor ${userId}`,
      packages,
    },
    matched_services: [],
  } as ExploreVendorSearchRow;
}

describe("multiVendorPackageSelection", () => {
  it("defaults to the cheapest priced package", () => {
    const v = vendor("v1", [
      { id: "p1", title: "Premium", price: "500" },
      { id: "p2", title: "Basic", price: "200" },
    ]);
    expect(defaultOptionIdForVendor(v)).toBe("p2");
  });

  it("builds initial selections for each vendor", () => {
    const vendors = [
      vendor("v1", [{ id: "a", title: "A", price: "100" }]),
      vendor("v2", [{ id: "b", title: "B", price: "150" }]),
    ];
    expect(initialOptionSelections(vendors)).toEqual({ v1: "a", v2: "b" });
  });
});
