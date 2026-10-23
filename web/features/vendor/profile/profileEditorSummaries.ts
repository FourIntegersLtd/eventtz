/**
 * One-line summaries for the live profile hub (design V28), derived from onboarding data.
 */
import { vendorCancellationPolicyLabel } from "@/features/bookings/cancellationPolicyCopy";
import {
  MIN_PORTFOLIO_IMAGES,
  RADIUS_OPTIONS,
  PROFILE_SECTIONS,
} from "@/lib/vendorOnboarding/constants";
import { describeWorkingDays } from "@/features/vendor/onboarding/reviewSummary";
import {
  formatReviewEventTypes,
  formatReviewServices,
  portfolioImageCountFromData,
} from "@/lib/vendorOnboarding/reviewDisplayHelpers";
import type { VendorOnboardingData } from "@/lib/vendorOnboarding/types";
import { vendorOnboardingStepErrors } from "@/features/vendor/onboarding/vendorOnboardingValidation";
import { isConfiguredPackage } from "@/lib/vendorOnboarding/packageQuality";

export type ProfileHubSectionRow = {
  slug: (typeof PROFILE_SECTIONS)[number]["slug"];
  step: number;
  title: string;
  summary: string;
  badge: { label: string; className: string };
};

function dietaryLine(data: VendorOnboardingData): string {
  const parts = [
    data.isHalal ? "Halal options" : null,
    data.isVegan || data.isVegetarian ? "dietary options" : null,
    data.allergenInfo.trim() ? "allergen policy" : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Optional details";
}

/** Rows for steps 2–8 on the profile hub checklist. */
export function profileHubSectionRows(data: VendorOnboardingData): ProfileHubSectionRow[] {
  const outwardCode = data.postalCode.trim().split(/\s+/)[0]?.toUpperCase() ?? "";
  const radiusLabel = RADIUS_OPTIONS.find((option) => option.value === data.travelRadius)?.label;
  const packageCount = data.packages.filter((item) => isConfiguredPackage(item)).length;
  const portfolioCount = portfolioImageCountFromData(data);
  const capacity = Number.parseInt(data.maxBookingsPerDay, 10);

  const specs: { step: number; title: string; summary: string }[] = [
    {
      step: 2,
      title: "Business",
      summary: [data.businessName.trim(), formatReviewServices(data.servicesOffered), formatReviewEventTypes(data.eventTypes)]
        .filter(Boolean)
        .join(" · "),
    },
    {
      step: 3,
      title: "Location",
      summary: [data.baseCity.trim(), outwardCode, radiusLabel ? `travels ${radiusLabel.toLowerCase()}` : null]
        .filter(Boolean)
        .join(" · "),
    },
    {
      step: 4,
      title: "Pricing and packages",
      summary: `${packageCount} package${packageCount === 1 ? "" : "s"} · ${vendorCancellationPolicyLabel(data.cancellationPolicy)} cancellation policy`,
    },
    {
      step: 6,
      title: "Availability",
      summary: [
        describeWorkingDays(data.availableWeekdays),
        Number.isNaN(capacity) ? null : `up to ${capacity} events a day`,
        `${data.blockedDates.length} date${data.blockedDates.length === 1 ? "" : "s"} blocked`,
      ]
        .filter(Boolean)
        .join(" · "),
    },
    {
      step: 7,
      title: "Portfolio",
      summary: `${portfolioCount} of ${MIN_PORTFOLIO_IMAGES} to 20 photos${data.portfolioVideoNamesPersisted.length > 0 ? " · 1 video" : ""}`,
    },
    {
      step: 8,
      title: "Additional info",
      summary: dietaryLine(data),
    },
  ];

  return specs.map((spec) => {
    const section = PROFILE_SECTIONS.find((item) => item.step === spec.step);
    const incomplete = vendorOnboardingStepErrors(spec.step, data).length > 0;
    const portfolioShort =
      spec.step === 7 && portfolioCount < MIN_PORTFOLIO_IMAGES
        ? { label: `Add ${MIN_PORTFOLIO_IMAGES - portfolioCount} more`, className: "ez-badge ez-badge--warning" }
        : null;
    const badge = portfolioShort ?? (incomplete
      ? { label: "Needs attention", className: "ez-badge ez-badge--warning" }
      : { label: "Complete", className: "ez-badge ez-badge--success" });
    return {
      slug: section?.slug ?? "business",
      step: spec.step,
      title: spec.title,
      summary: spec.summary || "Not filled in yet",
      badge,
    };
  });
}

/** Whole-profile completion percent for the hub card (steps 2–8). */
export function profileHubCompletionPercent(data: VendorOnboardingData): number {
  let complete = 0;
  for (let step = 2; step <= 8; step += 1) {
    if (vendorOnboardingStepErrors(step, data).length === 0) complete += 1;
  }
  return Math.round((complete / 7) * 100);
}
