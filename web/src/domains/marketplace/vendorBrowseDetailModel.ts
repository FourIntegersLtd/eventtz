/**
 * Pricing options and booking-estimate lines for the public vendor profile.
 * Built from the same JSON the vendor saves in onboarding. Display only.
 * Package construction lives in `browsePricingBuild.ts` so this file stays
 * the line-item maths the tests import.
 */
import { formatBookingEstimateLabel } from "./vendorDiscountDisplay";
import { lineTotalGbp, type PackagePricingMode } from "./packagePricing";

export {
  buildBrowsePricingOptions,
  extractBrowsePricingSharedContext,
  packageSpecificTravelLine,
} from "./browsePricingBuild";

/** One selectable package or fixed rate on the profile sidebar. */
export type BrowsePricingOption = {
  id: string;
  /** Short label for tab buttons. */
  tabLabel: string;
  /** Package name, or "Hourly rate" / "Daily rate". */
  heading: string;
  priceDisplay: string | null;
  compareAtDisplay: string | null;
  /** GBP amount for sums. Null means a custom quote. For per-unit packages this is the rate. */
  unitPriceGbp: number | null;
  pricingMode: PackagePricingMode;
  unitLabel: string | null;
  minQuantity: number;
  maxQuantity: number | null;
  /** Appended to the displayed price, e.g. "/ chair". */
  priceSuffix: string | null;
  discountBadge: string | null;
  travelLine: string | null;
  promoLines: string[];
  description: string;
  timelineLine: string | null;
  featureLines: string[];
};

/** Vendor-level lines shown once above the package list. */
export type BrowsePricingSharedContext = {
  travelLine: string | null;
  serviceLines: string[];
  promoLines: string[];
};

export type BookingLineItem = {
  id: string;
  heading: string;
  unitPriceGbp: number | null;
  quantity?: number;
  unitRateGbp?: number | null;
  unitLabel?: string | null;
};

/** Sum the selected options. Per-unit lines use quantity times the unit rate. */
export function buildBookingLineItems(
  options: BrowsePricingOption[],
  selectedIds: string[],
  quantities?: Record<string, number>,
): BookingLineItem[] {
  const selected = new Set(selectedIds);
  return options
    .filter((option) => selected.has(option.id))
    .map((option) => {
      const perUnit = option.pricingMode === "per_unit";
      const quantity = perUnit
        ? Math.max(quantities?.[option.id] ?? option.minQuantity, option.minQuantity)
        : 1;
      return {
        id: option.id,
        heading: option.heading,
        unitPriceGbp: lineTotalGbp(option.unitPriceGbp, quantity),
        quantity: perUnit ? quantity : undefined,
        unitRateGbp: perUnit ? option.unitPriceGbp : undefined,
        unitLabel: perUnit ? option.unitLabel : undefined,
      };
    });
}

/** Quantities to send with a booking request. Fixed packages are omitted. */
export function bookingQuantitiesPayload(
  selectedIds: string[],
  options: BrowsePricingOption[],
  quantities: Record<string, number>,
): Record<string, number> | undefined {
  const byId = new Map(options.map((option) => [option.id, option]));
  const payload: Record<string, number> = {};
  for (const id of selectedIds) {
    const option = byId.get(id);
    if (!option || option.pricingMode !== "per_unit") continue;
    payload[id] = Math.max(quantities[id] ?? option.minQuantity, option.minQuantity);
  }
  return Object.keys(payload).length > 0 ? payload : undefined;
}

/** Label and numeric sum for the selected lines. An empty selection is GBP 0.00. */
export function formatBookingTotalGbp(lines: BookingLineItem[]): {
  label: string;
  sumNumeric: number;
  hasTbc: boolean;
} {
  let sum = 0;
  let hasTbc = false;
  for (const line of lines) {
    if (line.unitPriceGbp == null) hasTbc = true;
    else sum += line.unitPriceGbp;
  }
  if (lines.length === 0) {
    return { label: "GBP 0.00", sumNumeric: 0, hasTbc: false };
  }
  return {
    label: formatBookingEstimateLabel(sum, hasTbc),
    sumNumeric: sum,
    hasTbc,
  };
}
