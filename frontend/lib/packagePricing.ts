/** Shared package pricing-mode helpers — keep in sync with backend list_pricing / package_quality. */

export const PACKAGE_PRICING_MODE_FIXED = "fixed";
export const PACKAGE_PRICING_MODE_PER_UNIT = "per_unit";

export type PackagePricingMode =
  | typeof PACKAGE_PRICING_MODE_FIXED
  | typeof PACKAGE_PRICING_MODE_PER_UNIT;

export const MAX_PACKAGE_QUANTITY = 100_000;

export function parsePackagePricingMode(raw: unknown): PackagePricingMode {
  if (typeof raw === "string" && raw.trim().toLowerCase() === PACKAGE_PRICING_MODE_PER_UNIT) {
    return PACKAGE_PRICING_MODE_PER_UNIT;
  }
  return PACKAGE_PRICING_MODE_FIXED;
}

export function isPerUnitPricing(mode: unknown): boolean {
  return parsePackagePricingMode(mode) === PACKAGE_PRICING_MODE_PER_UNIT;
}

/** Empty → null. Non-integer / out of range → null (callers distinguish invalid via the raw string). */
export function parsePackageQuantity(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isInteger(raw)) {
    return raw >= 1 && raw <= MAX_PACKAGE_QUANTITY ? raw : null;
  }
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t || !/^\d+$/.test(t)) return null;
  const n = Number.parseInt(t, 10);
  return n >= 1 && n <= MAX_PACKAGE_QUANTITY ? n : null;
}

export function packageQuantityInputInvalid(raw: unknown): boolean {
  if (raw == null) return false;
  if (typeof raw === "number") {
    return !Number.isInteger(raw) || raw < 1 || raw > MAX_PACKAGE_QUANTITY;
  }
  if (typeof raw !== "string") return true;
  const t = raw.trim();
  if (!t) return false;
  return parsePackageQuantity(t) === null;
}

export function defaultMinQuantity(rawMin: unknown): number {
  return parsePackageQuantity(rawMin) ?? 1;
}

export function perUnitPriceSuffix(unitLabel: string): string {
  const t = unitLabel.trim();
  return t ? `/ ${t}` : "each";
}

export function lineTotalGbp(unitRateGbp: number | null, quantity: number): number | null {
  if (unitRateGbp == null || !Number.isFinite(unitRateGbp)) return null;
  return Math.round(unitRateGbp * quantity * 100) / 100;
}
