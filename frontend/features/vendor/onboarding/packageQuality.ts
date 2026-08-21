/** Package completeness rules — keep in sync with backend/app/features/vendors/package_quality.py */

import {
  parseSingleMoneyNumber,
  singleGbpAmountFieldError,
} from "@/lib/validation/money";

export const MIN_PACKAGE_DESCRIPTION_CHARS = 40;
export const MIN_PACKAGE_TITLE_CHARS = 3;

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
};

export type PackageFieldErrors = {
  title: string | null;
  price: string | null;
  details: string | null;
  all: string[];
};

export function isConfiguredPackage(pkg: PackageLike): boolean {
  return Boolean(
    (pkg.title ?? "").trim() ||
      (pkg.price ?? "").trim() ||
      (pkg.details ?? "").trim() ||
      (pkg.duration ?? "").trim(),
  );
}

export function isCompletePackage(pkg: PackageLike): boolean {
  const title = (pkg.title ?? "").trim();
  const price = (pkg.price ?? "").trim();
  const details = (pkg.details ?? "").trim();
  return (
    title.length >= MIN_PACKAGE_TITLE_CHARS &&
    parseSingleMoneyNumber(price) !== null &&
    details.length >= MIN_PACKAGE_DESCRIPTION_CHARS
  );
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
  const hasAny = isConfiguredPackage(pkg);

  if (!hasAny) {
    return { title: null, price: null, details: null, all: [] };
  }

  let titleError: string | null = null;
  let priceError: string | null = null;
  let detailsError: string | null = null;

  if (!title || title.length < MIN_PACKAGE_TITLE_CHARS) {
    titleError = "Each package needs a clear name.";
  }
  if (!price) {
    priceError = "Each package needs a price.";
  } else {
    priceError = singleGbpAmountFieldError(price, "Package price", { required: true });
  }
  if (strict || price) {
    if (details.length < MIN_PACKAGE_DESCRIPTION_CHARS) {
      detailsError = "Tell clients what's included (at least a short sentence).";
    }
  }

  const all = [titleError, priceError, detailsError].filter(Boolean) as string[];
  return { title: titleError, price: priceError, details: detailsError, all };
}

export function countCompletePackages(packages: PackageLike[]): number {
  return packages.filter((p) => isConfiguredPackage(p) && isCompletePackage(p)).length;
}
