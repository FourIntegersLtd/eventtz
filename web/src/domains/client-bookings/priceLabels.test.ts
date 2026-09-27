import test from "node:test";
import assert from "node:assert/strict";
import {
  computeClientFeeBreakdown,
  formatAdjustmentAmount,
  clientTotalBeforeVendorAdjustments,
  referralDiscountForSpend,
  resolveWasClientTotalLabel,
} from "@/domains/client-bookings/priceLabels";

test("referralDiscountForSpend picks the tier for the spend", () => {
  assert.equal(referralDiscountForSpend(600), 15);
  assert.equal(referralDiscountForSpend(599.99), 10);
  assert.equal(referralDiscountForSpend(400), 10);
  assert.equal(referralDiscountForSpend(399.99), 0);
});

test("computeClientFeeBreakdown derives the fee, total and labels", () => {
  const noDiscount = computeClientFeeBreakdown({ vendorPortionGbp: 600, feePercent: 5, referralFeeDiscountGbp: 0 });
  assert.deepEqual(noDiscount && {
    feeGbp: noDiscount.feeGbp,
    totalGbp: noDiscount.totalGbp,
    vendorPortionLabel: noDiscount.vendorPortionLabel,
    feeLabel: noDiscount.feeLabel,
    totalLabel: noDiscount.totalLabel,
    referralDiscountLabel: noDiscount.referralDiscountLabel,
  }, { feeGbp: 30, totalGbp: 630, vendorPortionLabel: "£600", feeLabel: "£30", totalLabel: "£630", referralDiscountLabel: null });

  const withDiscount = computeClientFeeBreakdown({ vendorPortionGbp: 600, feePercent: 5, referralFeeDiscountGbp: 15 });
  assert.deepEqual(withDiscount && {
    feeGbp: withDiscount.feeGbp,
    totalGbp: withDiscount.totalGbp,
    totalLabel: withDiscount.totalLabel,
    referralDiscountLabel: withDiscount.referralDiscountLabel,
    referralApplied: withDiscount.referralApplied,
  }, { feeGbp: 15, totalGbp: 615, totalLabel: "£615", referralDiscountLabel: "-£15", referralApplied: true });
});

test("computeClientFeeBreakdown rejects a negative vendor portion", () => {
  assert.equal(computeClientFeeBreakdown({ vendorPortionGbp: -1 }), null);
});

test("clientTotalBeforeVendorAdjustments is null for TBC pricing", () => {
  assert.equal(clientTotalBeforeVendorAdjustments({ has_pricing_tbc: true }), null);
  assert.equal(clientTotalBeforeVendorAdjustments(null), null);
});

test("clientTotalBeforeVendorAdjustments applies the referral discount when a code is present", () => {
  assert.equal(
    clientTotalBeforeVendorAdjustments({ has_pricing_tbc: false, line_items_subtotal_gbp: 600, service_fee_percent: 5 }),
    "£630",
  );
  assert.equal(
    clientTotalBeforeVendorAdjustments({
      has_pricing_tbc: false,
      line_items_subtotal_gbp: 600,
      service_fee_percent: 5,
      vendor_referral_code: "PARTNER",
    }),
    "£615",
  );
});

test("resolveWasClientTotalLabel prefers the stored label, then computes, then the client/total label", () => {
  assert.equal(resolveWasClientTotalLabel({ initial_client_total_label: "GBP 600.00" }), "GBP 600.00");
  assert.equal(
    resolveWasClientTotalLabel({
      vendor_adjustments: [{ id: "adj-1" }],
      pricing: { has_pricing_tbc: false, line_items_subtotal_gbp: 600, service_fee_percent: 5 },
    }),
    "£630",
  );
  assert.equal(
    resolveWasClientTotalLabel({ pricing: { client_total_label: "£630" } }),
    "£630",
  );
  assert.equal(resolveWasClientTotalLabel({ total_label: "£50" }), "£50");
  assert.equal(resolveWasClientTotalLabel({}), "");
});

test("formatAdjustmentAmount signs the amount and drops pence on whole pounds", () => {
  assert.equal(formatAdjustmentAmount(25), "+£25");
  assert.equal(formatAdjustmentAmount(-12.5), "-£12.50");
  assert.equal(formatAdjustmentAmount(1250), "+£1,250");
});
