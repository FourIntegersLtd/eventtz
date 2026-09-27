/**
 * Package pricing-mode helpers for browse estimates.
 * Ported from the baseline `packagePricing.ts`. Display only — never sent as a price.
 */

export const PACKAGE_PRICING_MODE_FIXED = "fixed";
export const PACKAGE_PRICING_MODE_PER_UNIT = "per_unit";

export type PackagePricingMode =
  | typeof PACKAGE_PRICING_MODE_FIXED
  | typeof PACKAGE_PRICING_MODE_PER_UNIT;

/** Upper bound for a per-unit quantity, matching onboarding. */
export const MAX_PACKAGE_QUANTITY = 100_000;

/** `per_unit` when the payload says so; everything else is a fixed price. */
export function parsePackagePricingMode(raw: unknown): PackagePricingMode {
  if (typeof raw === "string" && raw.trim().toLowerCase() === PACKAGE_PRICING_MODE_PER_UNIT) {
    return PACKAGE_PRICING_MODE_PER_UNIT;
  }
  return PACKAGE_PRICING_MODE_FIXED;
}

/** True when the package is charged per chair, guest, hour, and so on. */
export function isPerUnitPricing(mode: unknown): boolean {
  return parsePackagePricingMode(mode) === PACKAGE_PRICING_MODE_PER_UNIT;
}

/**
 * Integer quantity in range, or null.
 * Empty and non-integers are null so callers can tell "missing" from "invalid".
 */
export function parsePackageQuantity(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isInteger(raw)) {
    return raw >= 1 && raw <= MAX_PACKAGE_QUANTITY ? raw : null;
  }
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || !/^\d+$/.test(trimmed)) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return parsed >= 1 && parsed <= MAX_PACKAGE_QUANTITY ? parsed : null;
}

/** True when a quantity field was filled in but is not a usable integer. */
export function packageQuantityInputInvalid(raw: unknown): boolean {
  if (raw == null) return false;
  if (typeof raw === "number") {
    return !Number.isInteger(raw) || raw < 1 || raw > MAX_PACKAGE_QUANTITY;
  }
  if (typeof raw !== "string") return true;
  const trimmed = raw.trim();
  if (!trimmed) return false;
  return parsePackageQuantity(trimmed) === null;
}

/** Package minimum, defaulting to 1 when the payload omits a valid minimum. */
export function defaultMinQuantity(rawMin: unknown): number {
  return parsePackageQuantity(rawMin) ?? 1;
}

/** Suffix shown after a unit rate, e.g. "/ chair". */
export function perUnitPriceSuffix(unitLabel: string): string {
  const trimmed = unitLabel.trim();
  return trimmed ? `/ ${trimmed}` : "each";
}

/** Unit rate times quantity, rounded to pence. Null when the rate is not a number. */
export function lineTotalGbp(unitRateGbp: number | null, quantity: number): number | null {
  if (unitRateGbp == null || !Number.isFinite(unitRateGbp)) return null;
  return Math.round(unitRateGbp * quantity * 100) / 100;
}
