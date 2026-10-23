/** Package completeness rules — keep in sync with backend/app/features/vendors/package_quality.py */

import {
  parseSingleMoneyNumber,
  singleGbpAmountFieldError,
} from "@/lib/validation/money";
import {
  isPerUnitPricing,
  packageQuantityInputInvalid,
  parsePackageQuantity,
  type PackagePricingMode,
} from "@/lib/packagePricing";

export const MIN_PACKAGE_DESCRIPTION_CHARS = 40;
export const MIN_PACKAGE_TITLE_CHARS = 3;
export const MAX_PACKAGE_UNIT_LABEL_CHARS = 40;

export const SERVICES_REQUIRING_PACKAGES = new Set([
  "catering",
  "baking",
  "makeup",
  "hair_styling",
  "decor",
  "event_planning",
]);

export type PackageLike = {
  id?: string;
  title?: string;
  price?: string;
  details?: string;
  duration?: string;
  pricingMode?: PackagePricingMode | string;
  unitLabel?: string;
  minQuantity?: string | number;
  maxQuantity?: string | number;
};

export type PackageFieldErrors = {
  title: string | null;
  price: string | null;
  details: string | null;
  unitLabel: string | null;
  minQuantity: string | null;
  maxQuantity: string | null;
  all: string[];
};

function emptyFieldErrors(): PackageFieldErrors {
  return {
    title: null,
    price: null,
    details: null,
    unitLabel: null,
    minQuantity: null,
    maxQuantity: null,
    all: [],
  };
}

export function isConfiguredPackage(pkg: PackageLike): boolean {
  return Boolean(
    (pkg.title ?? "").trim() ||
      (pkg.price ?? "").trim() ||
      (pkg.details ?? "").trim() ||
      (pkg.duration ?? "").trim() ||
      (pkg.unitLabel ?? "").trim() ||
      String(pkg.minQuantity ?? "").trim() ||
      String(pkg.maxQuantity ?? "").trim() ||
      isPerUnitPricing(pkg.pricingMode),
  );
}

export function isCompletePackage(pkg: PackageLike): boolean {
  const title = (pkg.title ?? "").trim();
  const price = (pkg.price ?? "").trim();
  const details = (pkg.details ?? "").trim();
  if (
    title.length < MIN_PACKAGE_TITLE_CHARS ||
    parseSingleMoneyNumber(price) === null ||
    details.length < MIN_PACKAGE_DESCRIPTION_CHARS
  ) {
    return false;
  }
  if (isPerUnitPricing(pkg.pricingMode)) {
    const unitLabel = (pkg.unitLabel ?? "").trim();
    if (!unitLabel || unitLabel.length > MAX_PACKAGE_UNIT_LABEL_CHARS) {
      return false;
    }
    if (packageQuantityInputInvalid(pkg.minQuantity) || packageQuantityInputInvalid(pkg.maxQuantity)) {
      return false;
    }
    const minQ = parsePackageQuantity(pkg.minQuantity);
    const maxQ = parsePackageQuantity(pkg.maxQuantity);
    if (minQ != null && maxQ != null && minQ > maxQ) {
      return false;
    }
  }
  return true;
}

export function servicesRequiringPackages(servicesOffered: string[]): string[] {
  return servicesOffered.filter((s) => SERVICES_REQUIRING_PACKAGES.has(s));
}

export function requiresAtLeastOnePackage(servicesOffered: string[]): boolean {
  return servicesRequiringPackages(servicesOffered).length > 0;
}

export function packageValidationErrors(
  pkg: PackageLike,
  opts?: { strict?: boolean },
): string[] {
  return packageFieldErrors(pkg, opts).all;
}

/** Structured field errors for onboarding package forms. */
export function packageFieldErrors(
  pkg: PackageLike,
  opts?: { strict?: boolean },
): PackageFieldErrors {
  const strict = opts?.strict ?? false;
  const title = (pkg.title ?? "").trim();
  const price = (pkg.price ?? "").trim();
  const details = (pkg.details ?? "").trim();
  const perUnit = isPerUnitPricing(pkg.pricingMode);
  const hasAny = isConfiguredPackage(pkg);

  if (!hasAny) {
    return emptyFieldErrors();
  }

  let titleError: string | null = null;
  let priceError: string | null = null;
  let detailsError: string | null = null;
  let unitLabelError: string | null = null;
  let minQuantityError: string | null = null;
  let maxQuantityError: string | null = null;

  if (!title || title.length < MIN_PACKAGE_TITLE_CHARS) {
    titleError = "Each package needs a clear name.";
  }
  if (!price) {
    priceError = perUnit
      ? "Each per-item package needs a unit price."
      : "Each package needs a price.";
  } else {
    priceError = singleGbpAmountFieldError(
      price,
      perUnit ? "Unit price" : "Package price",
      { required: true },
    );
  }
  if (strict || price) {
    if (details.length < MIN_PACKAGE_DESCRIPTION_CHARS) {
      detailsError = "Tell clients what's included (at least a short sentence).";
    }
  }
  if (perUnit) {
    const unitLabel = (pkg.unitLabel ?? "").trim();
    if (!unitLabel) {
      unitLabelError = "Name the item you charge for (e.g. chair, table).";
    } else if (unitLabel.length > MAX_PACKAGE_UNIT_LABEL_CHARS) {
      unitLabelError = "Keep the unit name short.";
    }
    if (packageQuantityInputInvalid(pkg.minQuantity)) {
      minQuantityError = "Minimum must be a whole number of at least 1.";
    }
    if (packageQuantityInputInvalid(pkg.maxQuantity)) {
      maxQuantityError = "Maximum must be a whole number of at least 1.";
    }
    const minQ = parsePackageQuantity(pkg.minQuantity);
    const maxQ = parsePackageQuantity(pkg.maxQuantity);
    if (minQ != null && maxQ != null && minQ > maxQ) {
      minQuantityError = "Minimum cannot be greater than maximum.";
    }
  }

  const all = [
    titleError,
    priceError,
    detailsError,
    unitLabelError,
    minQuantityError,
    maxQuantityError,
  ].filter(Boolean) as string[];
  return {
    title: titleError,
    price: priceError,
    details: detailsError,
    unitLabel: unitLabelError,
    minQuantity: minQuantityError,
    maxQuantity: maxQuantityError,
    all,
  };
}

export function countCompletePackages(packages: PackageLike[]): number {
  return packages.filter((p) => isConfiguredPackage(p) && isCompletePackage(p)).length;
}
