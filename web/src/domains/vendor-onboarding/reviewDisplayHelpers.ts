/** reviewDisplayHelpers for the vendor onboarding wizard. */

import { EVENT_TYPE_OPTIONS, MIN_PORTFOLIO_IMAGES } from "@/domains/vendor-onboarding/constants";
import type { PackageLike } from "@/domains/vendor-onboarding/packageQuality";
import type { VendorOnboardingData } from "@/domains/vendor-onboarding/types";
import { displayEventTypes, displayServicesOffered } from "@/domains/vendor-onboarding/browseLabels";
import { isPerUnitPricing, perUnitPriceSuffix } from "@/domains/vendor-onboarding/packagePricing";
import { portfolioFileKey } from "@/domains/vendor-onboarding/portfolioFileKey";

export function formatReviewServices(values: string[]): string {
  if (values.length === 0) return "-";
  return displayServicesOffered(values).join(", ");
}

export function formatReviewEventTypes(values: string[]): string {
  if (values.length === 0) return "-";
  if (values.includes("all")) {
    return EVENT_TYPE_OPTIONS.find((o) => o.value === "all")?.label ?? "All event types";
  }
  return displayEventTypes(values).join(", ");
}

export function formatReviewLabels(
  values: string[],
  options: { value: string; label: string }[],
): string {
  if (values.length === 0) return "-";
  return values.map((v) => options.find((o) => o.value === v)?.label ?? v).join(", ");
}

export function hasConfiguredDiscounts(data: VendorOnboardingData): boolean {
  if (!data.offerDiscounts) return false;
  return Boolean(
    data.discountLabel.trim() ||
      data.discountPercentage.trim() ||
      (data.bulkDiscountThreshold.trim() && data.bulkDiscountPercent.trim()) ||
      data.offPeakDiscountPercent.trim(),
  );
}

export function formatDiscountSummary(data: VendorOnboardingData): string[] {
  if (!data.offerDiscounts) return [];
  const lines: string[] = [];
  if (data.discountLabel.trim()) {
    lines.push(data.discountLabel.trim());
  }
  if (data.discountPercentage.trim()) {
    lines.push(
      `${data.discountPercentage.trim()}% off listed prices${
        data.discountLabel.trim() ? "" : " (list discount)"
      }`,
    );
  }
  if (data.bulkDiscountThreshold.trim() && data.bulkDiscountPercent.trim()) {
    lines.push(
      `${data.bulkDiscountPercent.trim()}% off over £${data.bulkDiscountThreshold.trim()}`,
    );
  }
  if (data.offPeakDiscountPercent.trim()) {
    lines.push(`${data.offPeakDiscountPercent.trim()}% off off-peak dates`);
  }
  if (lines.length === 0) {
    lines.push("Discounts enabled. Add details on the Pricing step.");
  }
  return lines;
}

export function hasDietaryDetails(data: VendorOnboardingData): boolean {
  return (
    data.isHalal ||
    data.isVegan ||
    data.isVegetarian ||
    data.isGlutenFree ||
    Boolean(data.allergenInfo.trim())
  );
}

export function hasAdditionalInfoContent(data: VendorOnboardingData): boolean {
  return (
    Boolean(data.foodHygieneCertNamePersisted) ||
    Boolean(data.indemnityCertNamePersisted) ||
    data.otherDocsNamesPersisted.length > 0 ||
    hasDietaryDetails(data)
  );
}

export function hasPortfolioContent(data: VendorOnboardingData): boolean {
  return (
    data.portfolioFileNamesPersisted.length > 0 ||
    data.portfolioFiles.length > 0 ||
    data.portfolioVideoNamesPersisted.length > 0 ||
    data.socialLinks.length > 0
  );
}

export function portfolioImageCountFromData(data: VendorOnboardingData): number {
  return new Set([
    ...data.portfolioFileNamesPersisted,
    ...data.portfolioFiles.map((file) => portfolioFileKey(file)),
  ]).size;
}

export function needsMorePortfolioPhotos(data: VendorOnboardingData): boolean {
  return portfolioImageCountFromData(data) < MIN_PORTFOLIO_IMAGES;
}

export function formatReviewBlockedDates(dates: string[]): string | null {
  if (dates.length === 0) return null;
  const formatIso = (iso: string): string => {
    const d = new Date(`${iso}T12:00:00Z`);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  };
  return [...dates]
    .map((d) => d.trim().slice(0, 10))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort()
    .map(formatIso)
    .join(", ");
}

/** Review / admin: `£120` or `£2 / chair`. Null when the price field is empty. */
export function formatReviewPackagePrice(pkg: PackageLike): string | null {
  const price = (pkg.price ?? "").trim();
  if (!price) return null;
  if (isPerUnitPricing(pkg.pricingMode)) {
    return `£${price} ${perUnitPriceSuffix(pkg.unitLabel ?? "")}`;
  }
  return `£${price}`;
}

/** Review / admin: optional min/max for per-item packages. */
export function formatReviewPackageQuantityBounds(pkg: PackageLike): string | null {
  if (!isPerUnitPricing(pkg.pricingMode)) return null;
  const min = String(pkg.minQuantity ?? "").trim();
  const max = String(pkg.maxQuantity ?? "").trim();
  if (min && max) return `Min ${min} · max ${max}`;
  if (min) return `Min ${min}`;
  if (max) return `Max ${max}`;
  return null;
}

export function packageTravelPolicyLabel(
  data: VendorOnboardingData,
  useDefaultTravel: boolean,
): string {
  if (!useDefaultTravel) {
    return "Custom travel rule for this package";
  }
  if (data.travelDeliveryPolicy === "custom") {
    return data.travelDeliveryPolicyCustomText.trim() || "Custom travel or delivery rule";
  }
  if (!data.travelDeliveryPolicy) return "Default travel rule not set";
  const labels: Record<string, string> = {
    fee_included: "Travel/delivery fee included",
    free_within_base_city:
      "Free delivery within base city (extra charges may apply outside this area)",
    fee_after_booking_request:
      "Travel/delivery fee will be provided after booking request",
    not_applicable: "Not applicable",
    custom: "Custom rule",
  };
  return labels[data.travelDeliveryPolicy] ?? data.travelDeliveryPolicy;
}

/** Fix raw service keys and odd casing in generated bios. */
export function normalizePublicBioText(text: string): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  const sentences = trimmed
    .split(/(?<=[.!?])\s+/)
    .map((s) => {
      const t = s.trim();
      if (!t) return "";
      return t.charAt(0).toUpperCase() + t.slice(1);
    })
    .filter(Boolean);
  return sentences.join(" ");
}
