/**
 * The wizard's review step (design V08) as plain data: one card per answered step with
 * short label and value rows, plus the readiness facts the aside checklist shows.
 * Kept out of the components so the wording and counts are unit-tested.
 */
import { phoneRequiredSchema } from "@/lib/validation/phone";
import {
  CANCELLATION_POLICY_KEYS,
  cancellationPolicyReviewLine,
  type CancellationPolicyKey,
} from "@/features/bookings/cancellationPolicyCopy";
import { isPerUnitPricing } from "@/lib/packagePricing";
import { RADIUS_OPTIONS, MIN_PORTFOLIO_IMAGES, SERVICE_OPTIONS, WEEKDAY_LABELS } from "./constants";
import { ONBOARDING_STEP } from "./onboardingProgress";
import { isConfiguredPackage } from "./packageQuality";
import {
  formatReviewEventTypes,
  formatReviewDeliveryModes,
  portfolioImageCountFromData,
} from "./reviewDisplayHelpers";
import type { VendorOnboardingData } from "./types";
import { uploadedFileDisplayName } from "./uploadedFileDisplayName";
import { vendorOnboardingStepErrors } from "./vendorOnboardingValidation";

/** One label and value line inside a review card. */
export type ReviewRow = { label: string; value: string };

/** One review card: the step it summarises, its rows, and whether that step still has errors. */
export type ReviewCard = {
  title: string;
  /** The wizard step the card's Edit link opens. */
  step: number;
  rows: ReviewRow[];
  incomplete: boolean;
};

/** "Thu to Sun" for a run of days, otherwise the names joined with commas. */
export function describeWorkingDays(weekdays: number[]): string {
  if (weekdays.length === 0) return "None chosen";
  const sorted = [...weekdays].sort((first, second) => first - second);
  const isRun = sorted.length > 2 && sorted[sorted.length - 1] - sorted[0] === sorted.length - 1;
  if (isRun) return `${WEEKDAY_LABELS[sorted[0]]} to ${WEEKDAY_LABELS[sorted[sorted.length - 1]]}`;
  return sorted.map((weekday) => WEEKDAY_LABELS[weekday]).join(", ");
}

/** "£18.00 per person" or "£450.00": the package price as the review shows it. */
function packagePriceLabel(pkg: VendorOnboardingData["packages"][number]): string {
  const amount = `£${Number(pkg.price).toFixed(2)}`;
  return isPerUnitPricing(pkg.pricingMode) ? `${amount} per ${pkg.unitLabel.trim() || "item"}` : amount;
}

/** "Halal, vegan, vegetarian": the ticked dietary options, empty when none. */
function dietarySummary(data: VendorOnboardingData): string {
  const ticked = [
    data.isHalal ? "Halal" : null,
    data.isVegan ? "Vegan" : null,
    data.isVegetarian ? "Vegetarian" : null,
    data.isGlutenFree ? "Gluten-free" : null,
  ].filter((option): option is string => option !== null);
  return ticked.join(", ");
}

/** Cancellation row on the review step (design V08 compact line). */
function cancellationSummary(data: VendorOnboardingData): string {
  return cancellationPolicyReviewLine(data.cancellationPolicy);
}

/** Names of the documents on file, in the order the step lists them. */
function documentNames(data: VendorOnboardingData): string[] {
  const names: string[] = [];
  if (data.foodHygieneCertNamePersisted) names.push("Food hygiene certificate");
  if (data.indemnityCertNamePersisted) names.push("Indemnity / insurance certificate");
  for (const url of data.otherDocsNamesPersisted) {
    names.push(uploadedFileDisplayName(url, data.uploadedFileLabels, "Document"));
  }
  return names;
}

/** The review cards in design order; a card for a step with errors is marked incomplete. */
export function buildReviewCards(data: VendorOnboardingData): ReviewCard[] {
  const serviceLabels = data.servicesOffered.map((value) => {
    if (value === "catering") return "Caterer";
    return SERVICE_OPTIONS.find((option) => option.value === value)?.label ?? value;
  });
  const outwardCode = data.postalCode.trim().split(/\s+/)[0]?.toUpperCase() ?? "";
  const radiusLabel = RADIUS_OPTIONS.find((option) => option.value === data.travelRadius)?.label;
  const packages = data.packages
    .filter((item) => isConfiguredPackage(item))
    .map((item) => `${item.title.trim() || "Untitled package"}, ${packagePriceLabel(item)}`);
  const capacity = Number.parseInt(data.maxBookingsPerDay, 10);
  const instagram = data.socialLinks.find((link) => link.platform === "instagram")?.handle.trim();
  const dietary = dietarySummary(data);
  const documents = documentNames(data);

  const cards: { title: string; step: number; rows: ReviewRow[] }[] = [
    {
      title: "Account",
      step: ONBOARDING_STEP.account,
      rows: [
        { label: "Name", value: [data.firstName, data.lastName].filter(Boolean).join(" ") || "-" },
        { label: "Phone", value: data.phone || "-" },
      ],
    },
    {
      title: "Business",
      step: ONBOARDING_STEP.business,
      rows: [
        { label: "Business", value: data.businessName || "-" },
        { label: "Service", value: serviceLabels.join(", ") || "-" },
        { label: "Events", value: formatReviewEventTypes(data.eventTypes) },
      ],
    },
    {
      title: "Location",
      step: ONBOARDING_STEP.location,
      rows: [
        {
          label: "Base",
          value: [data.baseCity.trim(), outwardCode].filter(Boolean).join(" ") || "-",
        },
        { label: "Delivery", value: formatReviewDeliveryModes(data.deliveryModes) },
        { label: "Reach", value: radiusLabel ?? "-" },
      ],
    },
    {
      title: "Pricing",
      step: ONBOARDING_STEP.pricing,
      rows: [{ label: "Packages", value: packages.join("; ") || "-" }],
    },
    {
      title: "Availability",
      step: ONBOARDING_STEP.availability,
      rows: [
        { label: "Days", value: describeWorkingDays(data.availableWeekdays) },
        {
          label: "Capacity",
          value: Number.isNaN(capacity) ? "-" : `${capacity} ${capacity === 1 ? "event" : "events"} a day`,
        },
        {
          label: "Blocked",
          value: `${data.blockedDates.length} ${data.blockedDates.length === 1 ? "date" : "dates"}`,
        },
      ],
    },
    {
      title: "Portfolio",
      step: ONBOARDING_STEP.portfolio,
      rows: [
        { label: "Photos", value: `${portfolioImageCountFromData(data)} uploaded` },
        { label: "Profile photo", value: data.profileImageUrl ? "Added" : "Not added" },
      ],
    },
    {
      title: "Additional info",
      step: ONBOARDING_STEP.additionalInfo,
      rows: [
        { label: "Cancellation", value: cancellationSummary(data) },
        ...(instagram ? [{ label: "Instagram", value: instagram }] : []),
        ...(dietary ? [{ label: "Dietary", value: dietary }] : []),
        ...(documents.length > 0 ? [{ label: "Documents", value: documents.join(", ") }] : []),
      ],
    },
  ];

  return cards.map((card) => ({
    ...card,
    incomplete: vendorOnboardingStepErrors(card.step, data).length > 0,
  }));
}

/** The facts behind the aside's "Ready to submit" checklist. */
export type ReviewReadiness = {
  stepsComplete: number;
  stepsTotal: number;
  photoCount: number;
  photosNeeded: number;
  cancellationChosen: boolean;
  phoneValid: boolean;
};

/** Counts the form steps (1 to 8) with no errors, plus the three named checks. */
export function reviewReadiness(data: VendorOnboardingData): ReviewReadiness {
  const stepsTotal = ONBOARDING_STEP.additionalInfo;
  let stepsComplete = 0;
  for (let step = 1; step <= stepsTotal; step += 1) {
    if (vendorOnboardingStepErrors(step, data).length === 0) stepsComplete += 1;
  }
  return {
    stepsComplete,
    stepsTotal,
    photoCount: portfolioImageCountFromData(data),
    photosNeeded: MIN_PORTFOLIO_IMAGES,
    cancellationChosen: (CANCELLATION_POLICY_KEYS as readonly string[]).includes(data.cancellationPolicy),
    phoneValid: phoneRequiredSchema.safeParse(data.phone).success,
  };
}
