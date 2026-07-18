import type { BookingPricing } from "@/features/bookings/BookingPricingBreakdown";
import { DEFAULT_CURRENCY, formatMoney } from "@/lib/markets";

/** Match backend pricing labels for price-update banners. */
export function formatGbpLabel(amount: number, currency: string = DEFAULT_CURRENCY): string {
  return formatMoney(amount, currency);
}

/** Client total from line items only (no vendor surcharges/discount adjustments). */
export function clientTotalBeforeVendorAdjustments(
  pricing: BookingPricing | null | undefined,
  currency: string = DEFAULT_CURRENCY,
): string | null {
  if (!pricing || pricing.has_pricing_tbc) return null;
  const fee =
    Math.round(pricing.line_items_subtotal_gbp * (pricing.service_fee_percent / 100) * 100) / 100;
  const total = Math.round((pricing.line_items_subtotal_gbp + fee) * 100) / 100;
  return formatGbpLabel(total, currency);
}

export function resolveWasClientTotalLabel(detail: {
  initial_client_total_label?: string | null;
  vendor_adjustments?: unknown[];
  pricing?: BookingPricing | null;
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
