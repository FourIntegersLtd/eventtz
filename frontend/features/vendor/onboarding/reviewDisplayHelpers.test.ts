import { describe, expect, it } from "vitest";
import {
  formatReviewPackagePrice,
  formatReviewPackageQuantityBounds,
} from "./reviewDisplayHelpers";

describe("formatReviewPackagePrice", () => {
  it("shows a lump-sum for fixed packages", () => {
    expect(formatReviewPackagePrice({ price: "500", pricingMode: "fixed" })).toBe(
      "£500",
    );
  });

  it("treats missing mode as fixed", () => {
    expect(formatReviewPackagePrice({ price: "120" })).toBe("£120");
  });

  it("shows a per-item rate with the unit label", () => {
    expect(
      formatReviewPackagePrice({
        price: "2",
        pricingMode: "per_unit",
        unitLabel: "chair",
      }),
    ).toBe("£2 / chair");
  });

  it("falls back to 'each' when the unit label is empty", () => {
    expect(
      formatReviewPackagePrice({
        price: "10",
        pricingMode: "per_unit",
        unitLabel: "",
      }),
    ).toBe("£10 each");
  });
});

describe("formatReviewPackageQuantityBounds", () => {
  it("is omitted for fixed packages", () => {
    expect(
      formatReviewPackageQuantityBounds({
        pricingMode: "fixed",
        minQuantity: "10",
        maxQuantity: "200",
      }),
    ).toBeNull();
  });

  it("shows min and max for per-item packages", () => {
    expect(
      formatReviewPackageQuantityBounds({
        pricingMode: "per_unit",
        minQuantity: "10",
        maxQuantity: "200",
      }),
    ).toBe("Min 10 · max 200");
  });
});
