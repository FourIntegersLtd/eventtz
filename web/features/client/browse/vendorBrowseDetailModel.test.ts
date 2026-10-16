import { describe, expect, it } from "vitest";
import {
  bookingQuantitiesPayload,
  buildBookingLineItems,
  buildBrowsePricingOptions,
  formatBookingTotalGbp,
} from "./vendorBrowseDetailModel";
import type { ExploreVendor } from "@/lib/clientExploreApi";

function vendor(packages: Record<string, unknown>[]): ExploreVendor {
  return {
    user_id: "v1",
    profile_form_data: { packages },
  } as ExploreVendor;
}

describe("browse per-unit pricing", () => {
  const chairs = {
    id: "pkg-chairs",
    title: "Chair hire",
    price: "2",
    details: "White folding chairs, 3-day hire, delivery and collection.",
    pricingMode: "per_unit",
    unitLabel: "chair",
    minQuantity: "10",
    maxQuantity: "200",
  };

  it("exposes unit rate and suffix on browse options", () => {
    const options = buildBrowsePricingOptions(vendor([chairs]));
    expect(options).toHaveLength(1);
    expect(options[0]?.pricingMode).toBe("per_unit");
    expect(options[0]?.unitPriceGbp).toBe(2);
    expect(options[0]?.priceSuffix).toBe("/ chair");
    expect(options[0]?.minQuantity).toBe(10);
  });

  it("multiplies unit rate by quantity for booking estimates", () => {
    const options = buildBrowsePricingOptions(vendor([chairs]));
    const lines = buildBookingLineItems(options, ["pkg-chairs"], { "pkg-chairs": 50 });
    expect(lines[0]?.unitPriceGbp).toBe(100);
    expect(lines[0]?.quantity).toBe(50);
    expect(lines[0]?.unitRateGbp).toBe(2);
  });

  it("only sends quantities for per-unit options", () => {
    const options = buildBrowsePricingOptions(
      vendor([
        chairs,
        {
          id: "pkg-gold",
          title: "Full setup",
          price: "500",
          details: "Full setup including delivery and collection on the day.",
        },
      ]),
    );
    const payload = bookingQuantitiesPayload(
      ["pkg-chairs", "pkg-gold"],
      options,
      { "pkg-chairs": 50, "pkg-gold": 3 },
    );
    expect(payload).toEqual({ "pkg-chairs": 50 });
  });

  it("keeps empty selection total at GBP 0.00", () => {
    expect(formatBookingTotalGbp([])).toEqual({
      label: "GBP 0.00",
      sumNumeric: 0,
      hasTbc: false,
    });
  });

  it("clamps per-unit quantities to package minimums", () => {
    const options = buildBrowsePricingOptions(vendor([chairs]));
    const payload = bookingQuantitiesPayload(["pkg-chairs"], options, { "pkg-chairs": 3 });
    expect(payload).toEqual({ "pkg-chairs": 10 });
  });

  it("returns undefined when no per-unit packages are selected", () => {
    const options = buildBrowsePricingOptions(
      vendor([
        {
          id: "pkg-gold",
          title: "Full setup",
          price: "500",
          details: "Full setup including delivery and collection on the day.",
        },
      ]),
    );
    expect(bookingQuantitiesPayload(["pkg-gold"], options, {})).toBeUndefined();
  });
});
