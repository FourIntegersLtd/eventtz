/** Package completeness rules — keep in sync with backend/app/features/vendors/package_quality.py */

export const MIN_PACKAGE_DESCRIPTION_CHARS = 40;
export const MIN_PACKAGE_TITLE_CHARS = 3;

export const SERVICES_REQUIRING_PACKAGES = new Set(["catering", "baking", "makeup"]);

export type PackageLike = {
  id?: string;
  title?: string;
  price?: string;
  details?: string;
  duration?: string;
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
    Boolean(price) &&
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
  const strict = opts?.strict ?? false;
  const title = (pkg.title ?? "").trim();
  const price = (pkg.price ?? "").trim();
  const details = (pkg.details ?? "").trim();
  const hasAny = isConfiguredPackage(pkg);
  if (!hasAny) return [];

  const errors: string[] = [];
  if (!title || title.length < MIN_PACKAGE_TITLE_CHARS) {
    errors.push("Each package needs a clear name.");
  }
  if (!price) errors.push("Each package needs a price.");
  if (strict || price) {
    if (details.length < MIN_PACKAGE_DESCRIPTION_CHARS) {
      errors.push("Tell clients what's included (at least a short sentence).");
    }
  }
  return errors;
}

export function countCompletePackages(packages: PackageLike[]): number {
  return packages.filter((p) => isConfiguredPackage(p) && isCompletePackage(p)).length;
}
