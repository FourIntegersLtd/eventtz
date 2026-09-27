import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeClientFeeBreakdown,
  formatBookingMoneyLabel,
  referralDiscountForBookingPreview,
  referralDiscountForSpend,
} from "./bookingServiceFee";

describe("bookingServiceFee", () => {
  it("computes fee breakdown for vendor portion £274", () => {
    const breakdown = computeClientFeeBreakdown({ vendorPortionGbp: 274 });
    assert.ok(breakdown);
    assert.equal(breakdown.vendorPortionGbp, 274);
    assert.equal(breakdown.feeBeforeDiscountGbp, 13.7);
    assert.equal(breakdown.referralDiscountGbp, 0);
    assert.equal(breakdown.feeGbp, 13.7);
    assert.equal(breakdown.totalGbp, 287.7);
    assert.equal(breakdown.feePercent, 5);
    assert.equal(breakdown.vendorPortionLabel, "£274");
    assert.equal(breakdown.feeLabel, "£13.70");
    assert.equal(breakdown.totalLabel, "£287.70");
    assert.equal(breakdown.referralApplied, false);
  });

  it("rounds fee and total to two decimal places", () => {
    const breakdown = computeClientFeeBreakdown({ vendorPortionGbp: 100.01 });
    assert.equal(breakdown?.feeGbp, 5);
    assert.equal(breakdown?.totalGbp, 105.01);
  });

  it("formats whole-pound amounts without trailing decimals", () => {
    assert.equal(formatBookingMoneyLabel(120), "£120");
    assert.equal(formatBookingMoneyLabel(13.7), "£13.70");
  });

  it("returns null for invalid vendor portion", () => {
    assert.equal(computeClientFeeBreakdown({ vendorPortionGbp: Number.NaN }), null);
    assert.equal(computeClientFeeBreakdown({ vendorPortionGbp: -1 }), null);
  });

  it("selects referral tier by vendor spend", () => {
    assert.equal(referralDiscountForSpend(399), 0);
    assert.equal(referralDiscountForSpend(399.99), 0);
    assert.equal(referralDiscountForSpend(400), 10);
    assert.equal(referralDiscountForSpend(500), 10);
    assert.equal(referralDiscountForSpend(599), 10);
    assert.equal(referralDiscountForSpend(599.99), 10);
    assert.equal(referralDiscountForSpend(600), 15);
  });

  it("referralDiscountForBookingPreview mirrors tier when code is on pricing", () => {
    assert.equal(referralDiscountForBookingPreview(null, 500), 0);
    assert.equal(referralDiscountForBookingPreview({ vendor_referral_code: "254106" }, 500), 10);
    assert.equal(referralDiscountForBookingPreview({ referral_fee_applied: true }, 500), 10);
    assert.equal(referralDiscountForBookingPreview({ vendor_referral_code: "254106" }, 350), 0);
    const breakdown = computeClientFeeBreakdown({
      vendorPortionGbp: 500,
      referralFeeDiscountGbp: referralDiscountForBookingPreview(
        { vendor_referral_code: "254106", service_fee_percent: 5 },
        500,
      ),
      feePercent: 5,
    });
    assert.equal(breakdown?.totalGbp, 515);
  });

  it("applies referral tier discount to service fee only", () => {
    const breakdown = computeClientFeeBreakdown({
      vendorPortionGbp: 400,
      referralFeeDiscountGbp: 10,
    });
    assert.equal(breakdown?.feeBeforeDiscountGbp, 20);
    assert.equal(breakdown?.referralDiscountGbp, 10);
    assert.equal(breakdown?.feeGbp, 10);
    assert.equal(breakdown?.totalGbp, 410);
    assert.equal(breakdown?.referralApplied, true);
    assert.equal(breakdown?.referralDiscountLabel, "-£10");
  });

  it("caps referral discount at standard fee", () => {
    const breakdown = computeClientFeeBreakdown({
      vendorPortionGbp: 50,
      referralFeeDiscountGbp: 10,
    });
    assert.equal(breakdown?.feeBeforeDiscountGbp, 2.5);
    assert.equal(breakdown?.referralDiscountGbp, 2.5);
    assert.equal(breakdown?.feeGbp, 0);
    assert.equal(breakdown?.totalGbp, 50);
  });

  it("matches backend plan-table examples", () => {
    const cases = [
      { vendor: 350, discount: 0, fee: 17.5, total: 367.5 },
      { vendor: 400, discount: 10, fee: 10, total: 410 },
      { vendor: 500, discount: 10, fee: 15, total: 515 },
      { vendor: 600, discount: 15, fee: 15, total: 615 },
      { vendor: 50, discount: 10, fee: 0, total: 50 },
    ] as const;
    for (const example of cases) {
      const breakdown = computeClientFeeBreakdown({
        vendorPortionGbp: example.vendor,
        referralFeeDiscountGbp: example.discount,
      });
      assert.equal(breakdown?.feeGbp, example.fee);
      assert.equal(breakdown?.totalGbp, example.total);
      assert.equal((breakdown?.vendorPortionGbp ?? 0) + (breakdown?.feeGbp ?? 0), example.total);
    }
  });

  it("includes surcharges in the fee base", () => {
    const breakdown = computeClientFeeBreakdown({ vendorPortionGbp: 110 });
    assert.equal(breakdown?.feeGbp, 5.5);
    assert.equal(breakdown?.totalGbp, 115.5);
  });

  it("applies fixed referral discount when vendor portion rises with a surcharge", () => {
    const breakdown = computeClientFeeBreakdown({
      vendorPortionGbp: 510,
      referralFeeDiscountGbp: 10,
    });
    assert.equal(breakdown?.feeBeforeDiscountGbp, 25.5);
    assert.equal(breakdown?.feeGbp, 15.5);
    assert.equal(breakdown?.totalGbp, 525.5);
  });
});
