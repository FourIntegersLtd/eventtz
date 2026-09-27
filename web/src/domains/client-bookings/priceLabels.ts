/**
 * Client fee and total-label maths, ported from the baseline's
 * `bookingServiceFee.ts` and `bookingPriceLabels.ts`. Money is GBP pounds
 * (floats) rounded to 2dp, matching the booking endpoints.
 */

export const BOOKING_SERVICE_FEE_PERCENT = 5;

export const REFERRAL_FEE_TIERS = [
  { minSpendGbp: 600, feeDiscountGbp: 15 },
  { minSpendGbp: 400, feeDiscountGbp: 10 },
] as const;

/** Lowest spend threshold for any referral tier (mirrors backend `tiers.py`). */
export const REFERRAL_LOWEST_TIER_SPEND_GBP = Math.min(
  ...REFERRAL_FEE_TIERS.map((tier) => tier.minSpendGbp),
);

/** The referral fee discount for a vendor-portion spend, or 0 below the lowest tier. */
export function referralDiscountForSpend(vendorPortionGbp: number): number {
  const spend = Math.max(0, vendorPortionGbp);
  for (const tier of REFERRAL_FEE_TIERS) {
    if (spend >= tier.minSpendGbp) return tier.feeDiscountGbp;
  }
  return 0;
}

export type BookingReferralPricingFields = {
  vendor_referral_code?: string | null;
  referral_fee_applied?: boolean | null;
};

/** Tier discount when the booking already carries a stored referral code (or applied fee). */
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

/** Friendly `£` label for a monetary amount, with 0–2 fraction digits. */
export function formatBookingMoneyLabel(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  const formatted = rounded.toLocaleString("en-GB", {
    minimumFractionDigits: rounded % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `£${formatted}`;
}

/** The client-facing fee breakdown; returns null when the vendor portion is invalid. */
export function computeClientFeeBreakdown(input: {
  vendorPortionGbp: number;
  feePercent?: number;
  referralFeeDiscountGbp?: number;
}): ClientFeeBreakdown | null {
  const vendorPortion = Math.round(input.vendorPortionGbp * 100) / 100;
  if (!Number.isFinite(vendorPortion) || vendorPortion < 0) return null;

  const feePercent = input.feePercent ?? BOOKING_SERVICE_FEE_PERCENT;
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

export type BookingPricingFields = {
  has_pricing_tbc?: boolean | null;
  line_items_subtotal_gbp?: number | null;
  service_fee_percent?: number | null;
  vendor_referral_code?: string | null;
  referral_fee_applied?: boolean | null;
};

/** Client total from line items only (no vendor surcharge/discount adjustments). */
export function clientTotalBeforeVendorAdjustments(
  pricing: BookingPricingFields | null | undefined,
): string | null {
  if (!pricing || pricing.has_pricing_tbc) return null;
  const referralDiscount = referralDiscountForBookingPreview(
    pricing,
    pricing.line_items_subtotal_gbp ?? 0,
  );
  const breakdown = computeClientFeeBreakdown({
    vendorPortionGbp: pricing.line_items_subtotal_gbp ?? 0,
    feePercent: pricing.service_fee_percent ?? BOOKING_SERVICE_FEE_PERCENT,
    referralFeeDiscountGbp: referralDiscount,
  });
  if (!breakdown) return null;
  return breakdown.totalLabel;
}

/** The "was" total shown on a price-update banner, resolved from the stored/client-total labels. */
export function resolveWasClientTotalLabel(detail: {
  initial_client_total_label?: string | null;
  vendor_adjustments?: { id: string }[] | null;
  pricing?: (BookingPricingFields & { client_total_label?: string | null }) | null;
  total_label?: string;
}): string {
  const stored = detail.initial_client_total_label?.trim();
  if (stored) return stored;
  if ((detail.vendor_adjustments?.length ?? 0) > 0) {
    const computed = clientTotalBeforeVendorAdjustments(detail.pricing);
    if (computed) return computed;
  }
  return detail.pricing?.client_total_label ?? detail.total_label ?? "";
}

/** A vendor adjustment as a signed amount ("+£25", "-£12.50"), as on the baseline's price-update banner. */
export function formatAdjustmentAmount(amountGbp: number): string {
  const absoluteAmount = Math.abs(amountGbp);
  const formatted = absoluteAmount.toLocaleString("en-GB", {
    minimumFractionDigits: absoluteAmount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return amountGbp < 0 ? `-£${formatted}` : `+£${formatted}`;
}
