/** reviewDisplayHelpers.test for the vendor onboarding wizard. */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatReviewPackagePrice,
  formatReviewPackageQuantityBounds,
} from "./reviewDisplayHelpers";

describe("formatReviewPackagePrice", () => {
  it("shows a lump-sum for fixed packages", () => {
    assert.equal(formatReviewPackagePrice({ price: "500", pricingMode: "fixed" }), 
      "£500",
    );
  });

  it("treats missing mode as fixed", () => {
    assert.equal(formatReviewPackagePrice({ price: "120" }), "£120");
  });

  it("shows a per-item rate with the unit label", () => {
    assert.equal(
      formatReviewPackagePrice({
        price: "2",
        pricingMode: "per_unit",
        unitLabel: "chair",
      }),
      "£2 / chair");
  });

  it("falls back to 'each' when the unit label is empty", () => {
    assert.equal(
      formatReviewPackagePrice({
        price: "10",
        pricingMode: "per_unit",
        unitLabel: "",
      }),
      "£10 each");
  });
});

describe("formatReviewPackageQuantityBounds", () => {
  it("is omitted for fixed packages", () => {
    assert.equal(
      formatReviewPackageQuantityBounds({
        pricingMode: "fixed",
        minQuantity: "10",
        maxQuantity: "200",
      }),
      null);
  });

  it("shows min and max for per-item packages", () => {
    assert.equal(
      formatReviewPackageQuantityBounds({
        pricingMode: "per_unit",
        minQuantity: "10",
        maxQuantity: "200",
      }),
      "Min 10 · max 200");
  });
});
