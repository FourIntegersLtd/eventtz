import {
  buildBrowsePricingOptions,
  type BrowsePricingOption,
} from "@/features/client/browse/vendorBrowseDetailModel";
import type { ExploreVendorSearchRow } from "@/lib/clientExploreApi";

export function vendorDisplayName(vendor: ExploreVendorSearchRow): string {
  const p = vendor.profile_form_data ?? {};
  const name = typeof p.businessName === "string" ? p.businessName.trim() : "";
  return name || "Vendor";
}

export function pricingOptionsForVendor(vendor: ExploreVendorSearchRow): BrowsePricingOption[] {
  return buildBrowsePricingOptions(vendor);
}

/** Default: cheapest priced package, else first listed option. */
export function defaultOptionIdForVendor(vendor: ExploreVendorSearchRow): string | null {
  const options = pricingOptionsForVendor(vendor);
  const priced = options.filter(
    (o) => o.unitPriceGbp != null && Number.isFinite(o.unitPriceGbp),
  );
  if (priced.length === 0) return options[0]?.id ?? null;
  return priced.reduce((best, o) =>
    (o.unitPriceGbp ?? Infinity) < (best.unitPriceGbp ?? Infinity) ? o : best,
  ).id;
}

export function initialOptionSelections(
  vendors: ExploreVendorSearchRow[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const vendor of vendors) {
    const optionId = defaultOptionIdForVendor(vendor);
    if (optionId) out[vendor.user_id] = optionId;
  }
  return out;
}

export function optionLabel(option: BrowsePricingOption): string {
  const price =
    option.priceDisplay != null && option.priceDisplay !== ""
      ? `£${option.priceDisplay}${option.priceSuffix ? ` ${option.priceSuffix}` : ""}`
      : "Quote on request";
  return `${option.heading} - ${price}`;
}

export function defaultQuantityForOption(option: BrowsePricingOption | undefined): number {
  if (!option) return 1;
  return option.pricingMode === "per_unit" ? option.minQuantity : 1;
}

export function initialQuantitiesForVendors(
  vendors: ExploreVendorSearchRow[],
  selectedOptionByVendorId: Record<string, string>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const vendor of vendors) {
    const optionId = selectedOptionByVendorId[vendor.user_id];
    if (!optionId) continue;
    const opt = pricingOptionsForVendor(vendor).find((o) => o.id === optionId);
    if (opt?.pricingMode === "per_unit") {
      out[vendor.user_id] = defaultQuantityForOption(opt);
    }
  }
  return out;
}
