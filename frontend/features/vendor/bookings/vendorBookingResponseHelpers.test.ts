import { describe, expect, it } from "vitest";
import { clientTotalBeforeVendorAdjustments } from "@/features/bookings/bookingPriceLabels";
import {
  previewClientTotalLabel,
  vendorReferralFeeNote,
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

describe("vendorReferralFeeNote", () => {
  it("explains the fee discount without changing payout", () => {
    expect(vendorReferralFeeNote(pricing())).toBe(
      "They used your referral code — £10 off the Eventtz fee. Your payout is unchanged.",
    );
  });

  it("is omitted when no referral discount applies", () => {
    expect(
      vendorReferralFeeNote(
        pricing({
          referral_fee_applied: false,
          referral_fee_discount_gbp: 0,
          vendor_referral_code: null,
        }),
      ),
    ).toBeNull();
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
