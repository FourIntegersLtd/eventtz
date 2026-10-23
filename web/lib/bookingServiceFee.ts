import policy from "@/lib/policyConstants.json";
import { formatGbp } from "./money";

/** Both numbers come from `policyConstants.json`; `test_policy_constants.py` keeps them equal to the API. */
export const BOOKING_SERVICE_FEE_PERCENT: number = policy.serviceFeePercent;

/** Best tier first, as the API lists them. */
export const REFERRAL_FEE_TIERS: readonly { minSpendGbp: number; feeDiscountGbp: number }[] =
  policy.referralFeeTiers;

/** Lowest spend threshold for any referral tier (derived from `policyConstants.json`, pinned to the api by `test_policy_constants.py`). */
export const REFERRAL_LOWEST_TIER_SPEND_GBP = Math.min(
  ...REFERRAL_FEE_TIERS.map((tier) => tier.minSpendGbp),
);

export function getBookingServiceFeePercent(): number {
  return BOOKING_SERVICE_FEE_PERCENT;
}

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

/** Tier discount for live previews when a booking already has a stored referral code. */
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

/**
 * Client-facing fee breakdown — mirrors backend `build_pricing_breakdown` rounding.
 * Returns null when vendor portion is invalid.
 */
export function computeClientFeeBreakdown(input: {
  vendorPortionGbp: number;
  feePercent?: number;
  referralFeeDiscountGbp?: number;
}): ClientFeeBreakdown | null {
  const vendorPortion = Math.round(input.vendorPortionGbp * 100) / 100;
  if (!Number.isFinite(vendorPortion) || vendorPortion < 0) return null;

  const feePct = input.feePercent ?? getBookingServiceFeePercent();
  const feeBefore = Math.round(vendorPortion * (feePct / 100) * 100) / 100;
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
    feePercent: feePct,
    vendorPortionLabel: formatGbp(vendorPortion, { roundToPence: true }),
    feeBeforeDiscountLabel: formatGbp(feeBefore, { roundToPence: true }),
    referralDiscountLabel:
      discountApplied > 0 ? `-${formatGbp(discountApplied, { roundToPence: true })}` : null,
    feeLabel: formatGbp(fee, { roundToPence: true }),
    totalLabel: formatGbp(total, { roundToPence: true }),
    referralApplied: discountApplied > 0,
  };
}
