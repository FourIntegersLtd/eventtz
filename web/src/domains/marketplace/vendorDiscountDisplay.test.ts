import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeBookingEstimateGbp,
  isOffPeakDate,
  listPriceDisplay,
  parseSingleMoneyNumber,
  parseVendorDiscountConfig,
} from "./vendorDiscountDisplay";

describe("vendorDiscountDisplay", () => {
  it("parses one fixed amount and rejects a range", () => {
    assert.equal(parseSingleMoneyNumber("2"), 2);
    assert.equal(parseSingleMoneyNumber("£150.50"), 150.5);
    assert.equal(parseSingleMoneyNumber("100-200"), null);
    assert.equal(parseSingleMoneyNumber(""), null);
  });

  it("shows a crossed-out list price when the main discount is active", () => {
    const config = parseVendorDiscountConfig({
      offerDiscounts: true,
      discountPercentage: "10",
      discountLabel: "Easter",
    });
    const display = listPriceDisplay(200, config);
    assert.equal(display.priceDisplay, "180");
    assert.equal(display.compareAtDisplay, "200");
    assert.equal(display.unitPriceGbp, 180);
    assert.equal(display.discountBadge, "10% off - Easter");
  });

  it("applies bulk then off-peak on a winter date", () => {
    assert.equal(isOffPeakDate("2026-01-15"), true);
    assert.equal(isOffPeakDate("2026-07-01"), false);
    const estimate = computeBookingEstimateGbp(
      [{ id: "pkg", heading: "Package", unitPriceGbp: 500 }],
      {
        offerDiscounts: true,
        bulkDiscountThreshold: "400",
        bulkDiscountPercent: "10",
        offPeakDiscountPercent: "10",
      },
      "2026-01-15",
    );
    assert.equal(estimate.hasTbc, false);
    assert.equal(estimate.autoLines.length, 2);
    assert.equal(estimate.sumNumeric, 405);
  });
});
