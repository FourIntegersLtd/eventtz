import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  bookingQuantitiesPayload,
  buildBookingLineItems,
  buildBrowsePricingOptions,
  formatBookingTotalGbp,
} from "./vendorBrowseDetailModel";

function vendor(packages: Record<string, unknown>[]) {
  return { profile_form_data: { packages } };
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
    assert.equal(options.length, 1);
    assert.equal(options[0]?.pricingMode, "per_unit");
    assert.equal(options[0]?.unitPriceGbp, 2);
    assert.equal(options[0]?.priceSuffix, "/ chair");
    assert.equal(options[0]?.minQuantity, 10);
  });

  it("multiplies unit rate by quantity for booking estimates", () => {
    const options = buildBrowsePricingOptions(vendor([chairs]));
    const lines = buildBookingLineItems(options, ["pkg-chairs"], { "pkg-chairs": 50 });
    assert.equal(lines[0]?.unitPriceGbp, 100);
    assert.equal(lines[0]?.quantity, 50);
    assert.equal(lines[0]?.unitRateGbp, 2);
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
    assert.deepEqual(payload, { "pkg-chairs": 50 });
  });

  it("keeps empty selection total at GBP 0.00", () => {
    assert.deepEqual(formatBookingTotalGbp([]), {
      label: "GBP 0.00",
      sumNumeric: 0,
      hasTbc: false,
    });
  });

  it("clamps per-unit quantities to package minimums", () => {
    const options = buildBrowsePricingOptions(vendor([chairs]));
    const payload = bookingQuantitiesPayload(["pkg-chairs"], options, { "pkg-chairs": 3 });
    assert.deepEqual(payload, { "pkg-chairs": 10 });
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
    assert.equal(bookingQuantitiesPayload(["pkg-gold"], options, {}), undefined);
  });
});
