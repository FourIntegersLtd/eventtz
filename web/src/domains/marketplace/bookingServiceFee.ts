/**
 * Client-facing service-fee estimate for the vendor profile.
 * Mirrors backend fee percent and referral tiers. Display only — the browser never sends this price.
 */

/** Matches backend `BOOKING_SERVICE_FEE_PERCENT`. */
export const BOOKING_SERVICE_FEE_PERCENT = 5;

/** Referral fee taken off the Eventtz fee, not the vendor portion. Highest tier first. */
export const REFERRAL_FEE_TIERS = [
  { minSpendGbp: 600, feeDiscountGbp: 15 },
  { minSpendGbp: 400, feeDiscountGbp: 10 },
] as const;

/** Lowest spend that qualifies for any referral tier. */
export const REFERRAL_LOWEST_TIER_SPEND_GBP = Math.min(
  ...REFERRAL_FEE_TIERS.map((tier) => tier.minSpendGbp),
);

/** The platform fee percent used when a preview does not override it. */
export function getBookingServiceFeePercent(): number {
  return BOOKING_SERVICE_FEE_PERCENT;
}

/** Tier discount in pounds for a vendor-portion spend. Zero below the lowest tier. */
export function referralDiscountForSpend(vendorPortionGbp: number): number {
  const spend = Math.max(0, vendorPortionGbp);
  for (const tier of REFERRAL_FEE_TIERS) {
    if (spend >= tier.minSpendGbp) return tier.feeDiscountGbp;
  }
  return 0;
}

export type BookingReferralPricingFields = {
  vendor_referral_code?: string | null;
  referral_fee_applied?: boolean;
  service_fee_percent?: number;
};

/** Tier discount for a live preview when a booking already stores a referral code. */
export function referralDiscountForBookingPreview(
  pricing: BookingReferralPricingFields | null | undefined,
  vendorPortionGbp: number,
): number {
  if (!pricing) return 0;
  if (!pricing.vendor_referral_code && !pricing.referral_fee_applied) return 0;
  return referralDiscountForSpend(vendorPortionGbp);
}

export type ClientFeeBreakdown = {
  vendorPortionGbp: number;
  feeBeforeDiscountGbp: number;
  referralDiscountGbp: number;
  feeGbp: number;
  totalGbp: number;
  feePercent: number;
  vendorPortionLabel: string;
  feeBeforeDiscountLabel: string;
  referralDiscountLabel: string | null;
  feeLabel: string;
  totalLabel: string;
  referralApplied: boolean;
};

/** Friendly £ label. Whole pounds omit trailing decimals. */
export function formatBookingMoneyLabel(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  const formatted = rounded.toLocaleString("en-GB", {
    minimumFractionDigits: rounded % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `£${formatted}`;
}

/**
 * Client-facing fee breakdown. Mirrors backend rounding.
 * Returns null when the vendor portion is not a finite non-negative number.
 */
export function computeClientFeeBreakdown(input: {
  vendorPortionGbp: number;
  feePercent?: number;
  referralFeeDiscountGbp?: number;
}): ClientFeeBreakdown | null {
  const vendorPortion = Math.round(input.vendorPortionGbp * 100) / 100;
  if (!Number.isFinite(vendorPortion) || vendorPortion < 0) return null;

  const feePercent = input.feePercent ?? getBookingServiceFeePercent();
  const feeBefore = Math.round(vendorPortion * (feePercent / 100) * 100) / 100;
  const rawDiscount = Math.max(0, input.referralFeeDiscountGbp ?? 0);
  const discountApplied = Math.round(Math.min(rawDiscount, feeBefore) * 100) / 100;
  const fee = Math.round(Math.max(0, feeBefore - discountApplied) * 100) / 100;
  const total = Math.round((vendorPortion + fee) * 100) / 100;

  return {
    vendorPortionGbp: vendorPortion,
    feeBeforeDiscountGbp: feeBefore,
    referralDiscountGbp: discountApplied,
    feeGbp: fee,
    totalGbp: total,
    feePercent,
    vendorPortionLabel: formatBookingMoneyLabel(vendorPortion),
    feeBeforeDiscountLabel: formatBookingMoneyLabel(feeBefore),
    referralDiscountLabel: discountApplied > 0 ? `-${formatBookingMoneyLabel(discountApplied)}` : null,
    feeLabel: formatBookingMoneyLabel(fee),
    totalLabel: formatBookingMoneyLabel(total),
    referralApplied: discountApplied > 0,
  };
}
