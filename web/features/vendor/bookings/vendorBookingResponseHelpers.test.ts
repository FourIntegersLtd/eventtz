import { describe, expect, it } from "vitest";
import { clientTotalBeforeVendorAdjustments } from "@/features/bookings/bookingPriceLabels";
import {
  adjustmentPreviewDeltaExplanation,
  formatTotalDeltaLabel,
  previewClientFeeBreakdown,
  previewClientTotalLabel,
  previewTotalDeltaGbp,
} from "@/features/vendor/bookings/vendorBookingResponseHelpers";
import type { BookingPricing } from "@/features/bookings/BookingPricingBreakdown";

function pricing(overrides: Partial<BookingPricing> = {}): BookingPricing {
  return {
    line_items_subtotal_gbp: 380,
    vendor_adjustments: [],
    vendor_portion_gbp: 400,
    adjustments_total_gbp: 20,
    service_fee_percent: 5,
    service_fee_gbp: 10,
    service_fee_before_discount_gbp: 20,
    referral_fee_discount_gbp: 10,
    referral_fee_applied: true,
    vendor_referral_code: "482910",
    client_total_gbp: 410,
    has_pricing_tbc: false,
    vendor_portion_label: "£400",
    service_fee_label: "£10",
    client_total_label: "£410",
    line_items_subtotal_label: "£380",
    ...overrides,
  };
}

describe("previewClientTotalLabel", () => {
  it("applies referral tier when surcharge pushes vendor portion over £400", () => {
    const label = previewClientTotalLabel(pricing(), [
      { kind: "cost", tag: "setup", label: "Setup", amount: "20" },
    ]);
    expect(label).toBe("£410");
  });

  it("returns null when vendor portion would be non-positive", () => {
    const label = previewClientTotalLabel(
      pricing({ line_items_subtotal_gbp: 50 }),
      [{ kind: "discount", tag: "discount", label: "Discount", amount: "60" }],
    );
    expect(label).toBeNull();
  });

  it("omits referral discount when booking has no referral code", () => {
    const label = previewClientTotalLabel(
      pricing({
        vendor_referral_code: null,
        referral_fee_applied: false,
        referral_fee_discount_gbp: 0,
      }),
      [],
    );
    expect(label).toBe("£399");
  });
});

describe("previewClientFeeBreakdown", () => {
  it("includes Eventtz fee on surcharges when referral discount is fixed", () => {
    const base = pricing({
      line_items_subtotal_gbp: 500,
      vendor_portion_gbp: 500,
      client_total_gbp: 515,
      client_total_label: "£515",
      service_fee_gbp: 15,
      service_fee_before_discount_gbp: 25,
      referral_fee_discount_gbp: 10,
      referral_fee_applied: true,
      vendor_referral_code: "254106",
    });
    const drafts = [{ kind: "cost" as const, tag: "other", label: "for delivery", amount: "10" }];
    const breakdown = previewClientFeeBreakdown(base, drafts);
    expect(breakdown?.vendorPortionGbp).toBe(510);
    expect(breakdown?.feeBeforeDiscountGbp).toBe(25.5);
    expect(breakdown?.referralDiscountGbp).toBe(10);
    expect(breakdown?.feeGbp).toBe(15.5);
    expect(breakdown?.totalGbp).toBe(525.5);
    expect(breakdown?.totalLabel).toBe("£525.50");
  });
});

describe("previewTotalDeltaGbp", () => {
  it("returns the extra client cost when a surcharge increases the fee base", () => {
    const base = pricing({
      line_items_subtotal_gbp: 500,
      vendor_portion_gbp: 500,
      client_total_gbp: 515,
      client_total_label: "£515",
      referral_fee_applied: true,
      vendor_referral_code: "254106",
    });
    const drafts = [{ kind: "cost" as const, tag: "other", label: "for delivery", amount: "10" }];
    expect(previewTotalDeltaGbp(base, drafts)).toBe(10.5);
    expect(formatTotalDeltaLabel(10.5)).toBe("+£10.50");
  });
});

describe("adjustmentPreviewDeltaExplanation", () => {
  it("splits a £10 surcharge into payout and Eventtz fee for the client", () => {
    const base = pricing({
      line_items_subtotal_gbp: 500,
      client_total_gbp: 515,
      referral_fee_applied: true,
      vendor_referral_code: "254106",
    });
    const drafts = [{ kind: "cost" as const, tag: "other", label: "delivery", amount: "10" }];
    const delta = previewTotalDeltaGbp(base, drafts);
    expect(delta).toBe(10.5);
    expect(adjustmentPreviewDeltaExplanation(base, drafts, delta!)).toBe(
      "+£10.50 for them: £10 to you + £0.50 Eventtz fee (5%).",
    );
  });

  it("splits a £20 surcharge so vendors see why +£21 is not a mistake", () => {
    const base = pricing({
      line_items_subtotal_gbp: 500,
      client_total_gbp: 515,
      referral_fee_applied: true,
      vendor_referral_code: "254106",
    });
    const drafts = [{ kind: "cost" as const, tag: "other", label: "setup fee", amount: "20" }];
    const delta = previewTotalDeltaGbp(base, drafts);
    expect(delta).toBe(21);
    expect(adjustmentPreviewDeltaExplanation(base, drafts, delta!)).toBe(
      "+£21 for them: £20 to you + £1 Eventtz fee (5%).",
    );
  });
});

describe("clientTotalBeforeVendorAdjustments", () => {
  it("includes referral discount on the line-item fee", () => {
    const label = clientTotalBeforeVendorAdjustments(
      pricing({
        line_items_subtotal_gbp: 500,
        vendor_portion_gbp: 500,
        client_total_gbp: 515,
        referral_fee_discount_gbp: 10,
        referral_fee_applied: true,
        vendor_referral_code: "254106",
      }),
    );
    expect(label).toMatch(/515/);
  });
});
