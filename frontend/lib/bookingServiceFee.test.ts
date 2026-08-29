import { describe, expect, it } from "vitest";
import {
  computeClientFeeBreakdown,
  formatBookingMoneyLabel,
} from "@/lib/bookingServiceFee";

describe("bookingServiceFee", () => {
  it("computes fee breakdown for vendor portion £274", () => {
    const breakdown = computeClientFeeBreakdown({ vendorPortionGbp: 274 });
    expect(breakdown).toEqual({
      vendorPortionGbp: 274,
      feeGbp: 13.7,
      totalGbp: 287.7,
      feePercent: 5,
      vendorPortionLabel: "£274",
      feeLabel: "£13.70",
      totalLabel: "£287.70",
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

  it("uses fee base separately from vendor portion for discounts", () => {
    const breakdown = computeClientFeeBreakdown({
      vendorPortionGbp: 950,
      feeBaseGbp: 900,
    });
    expect(breakdown?.feeGbp).toBe(45);
    expect(breakdown?.totalGbp).toBe(995);
  });

  it("returns null for invalid vendor portion", () => {
    expect(computeClientFeeBreakdown({ vendorPortionGbp: Number.NaN })).toBeNull();
    expect(computeClientFeeBreakdown({ vendorPortionGbp: -1 })).toBeNull();
  });
});
