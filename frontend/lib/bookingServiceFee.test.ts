import { describe, expect, it } from "vitest";
import {
  computeClientFeeBreakdown,
  formatBookingMoneyLabel,
  referralDiscountForSpend,
} from "@/lib/bookingServiceFee";

describe("bookingServiceFee", () => {
  it("computes fee breakdown for vendor portion £274", () => {
    const breakdown = computeClientFeeBreakdown({ vendorPortionGbp: 274 });
    expect(breakdown).toMatchObject({
      vendorPortionGbp: 274,
      feeBeforeDiscountGbp: 13.7,
      referralDiscountGbp: 0,
      feeGbp: 13.7,
      totalGbp: 287.7,
      feePercent: 5,
      vendorPortionLabel: "£274",
      feeLabel: "£13.70",
      totalLabel: "£287.70",
      referralApplied: false,
    });
  });

  it("rounds fee and total to two decimal places", () => {
    const breakdown = computeClientFeeBreakdown({ vendorPortionGbp: 100.01 });
    expect(breakdown?.feeGbp).toBe(5);
    expect(breakdown?.totalGbp).toBe(105.01);
  });

  it("formats whole-pound amounts without trailing decimals", () => {
    expect(formatBookingMoneyLabel(120)).toBe("£120");
    expect(formatBookingMoneyLabel(13.7)).toBe("£13.70");
  });

  it("returns null for invalid vendor portion", () => {
    expect(computeClientFeeBreakdown({ vendorPortionGbp: Number.NaN })).toBeNull();
    expect(computeClientFeeBreakdown({ vendorPortionGbp: -1 })).toBeNull();
  });

  it("selects referral tier by vendor spend", () => {
    expect(referralDiscountForSpend(399)).toBe(0);
    expect(referralDiscountForSpend(399.99)).toBe(0);
    expect(referralDiscountForSpend(400)).toBe(10);
    expect(referralDiscountForSpend(500)).toBe(10);
    expect(referralDiscountForSpend(599)).toBe(10);
    expect(referralDiscountForSpend(599.99)).toBe(10);
    expect(referralDiscountForSpend(600)).toBe(15);
  });

  it("applies referral tier discount to service fee only", () => {
    const breakdown = computeClientFeeBreakdown({
      vendorPortionGbp: 400,
      referralFeeDiscountGbp: 10,
    });
    expect(breakdown?.feeBeforeDiscountGbp).toBe(20);
    expect(breakdown?.referralDiscountGbp).toBe(10);
    expect(breakdown?.feeGbp).toBe(10);
    expect(breakdown?.totalGbp).toBe(410);
    expect(breakdown?.referralApplied).toBe(true);
    expect(breakdown?.referralDiscountLabel).toBe("-£10");
  });

  it("caps referral discount at standard fee", () => {
    const breakdown = computeClientFeeBreakdown({
      vendorPortionGbp: 50,
      referralFeeDiscountGbp: 10,
    });
    expect(breakdown?.feeBeforeDiscountGbp).toBe(2.5);
    expect(breakdown?.referralDiscountGbp).toBe(2.5);
    expect(breakdown?.feeGbp).toBe(0);
    expect(breakdown?.totalGbp).toBe(50);
  });

  it("matches backend plan-table examples", () => {
    const cases = [
      { vendor: 350, discount: 0, fee: 17.5, total: 367.5 },
      { vendor: 400, discount: 10, fee: 10, total: 410 },
      { vendor: 500, discount: 10, fee: 15, total: 515 },
      { vendor: 600, discount: 15, fee: 15, total: 615 },
      { vendor: 50, discount: 10, fee: 0, total: 50 },
    ] as const;
    for (const c of cases) {
      const breakdown = computeClientFeeBreakdown({
        vendorPortionGbp: c.vendor,
        referralFeeDiscountGbp: c.discount,
      });
      expect(breakdown?.feeGbp).toBe(c.fee);
      expect(breakdown?.totalGbp).toBe(c.total);
      expect((breakdown?.vendorPortionGbp ?? 0) + (breakdown?.feeGbp ?? 0)).toBe(c.total);
    }
  });

  it("includes surcharges in the fee base", () => {
    const vendorPortion = 110;
    const breakdown = computeClientFeeBreakdown({ vendorPortionGbp: vendorPortion });
    expect(breakdown?.feeGbp).toBe(5.5);
    expect(breakdown?.totalGbp).toBe(115.5);
  });
});
