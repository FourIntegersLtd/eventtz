/** Matches backend `BOOKING_SERVICE_FEE_PERCENT` in `app/core/constants.py`. */

export const BOOKING_SERVICE_FEE_PERCENT = 5;

export function getBookingServiceFeePercent(): number {
  return BOOKING_SERVICE_FEE_PERCENT;
}

export type ClientFeeBreakdown = {
  vendorPortionGbp: number;
  feeGbp: number;
  totalGbp: number;
  feePercent: number;
  vendorPortionLabel: string;
  feeLabel: string;
  totalLabel: string;
};

/** Friendly £ label for browse/modal estimates (matches breakdown row styling). */
export function formatBookingMoneyLabel(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  const formatted = rounded.toLocaleString("en-GB", {
    minimumFractionDigits: rounded % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `£${formatted}`;
}

/**
 * Client-facing fee breakdown — mirrors backend `build_pricing_breakdown` rounding.
 * Returns null when vendor portion is invalid.
 */
export function computeClientFeeBreakdown(input: {
  vendorPortionGbp: number;
  feePercent?: number;
  /** Fee base when discounts reduce the taxable amount (defaults to vendor portion). */
  feeBaseGbp?: number;
}): ClientFeeBreakdown | null {
  const vendorPortion = Math.round(input.vendorPortionGbp * 100) / 100;
  if (!Number.isFinite(vendorPortion) || vendorPortion < 0) return null;

  const feePct = input.feePercent ?? getBookingServiceFeePercent();
  const feeBase = Math.round(Math.max(0, input.feeBaseGbp ?? vendorPortion) * 100) / 100;
  const fee = Math.round(feeBase * (feePct / 100) * 100) / 100;
  const total = Math.round((vendorPortion + fee) * 100) / 100;

  return {
    vendorPortionGbp: vendorPortion,
    feeGbp: fee,
    totalGbp: total,
    feePercent: feePct,
    vendorPortionLabel: formatBookingMoneyLabel(vendorPortion),
    feeLabel: formatBookingMoneyLabel(fee),
    totalLabel: formatBookingMoneyLabel(total),
  };
}
