import { EVENT_TYPE_IDS_ALL, EVENT_TYPE_OPTIONS } from "./constants";
import type { VendorOnboardingData } from "./types";

const BIO_MAX_WORDS = 60;

function formatEventTypesForBio(types: string[]): string {
  if (types.length === 0) return "celebrations";
  if (types.includes("all")) {
    return EVENT_TYPE_IDS_ALL.map(
      (id) => EVENT_TYPE_OPTIONS.find((o) => o.value === id)?.label ?? id,
    ).join(", ");
  }
  return types
    .filter((t) => t !== "all")
    .map((t) => EVENT_TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t)
    .join(", ");
}

/** Caps a bio to a single paragraph of ~60 words, on a whole-word boundary. */
export function clampBioWords(text: string, maxWords: number = BIO_MAX_WORDS): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text.trim();
  return `${words.slice(0, maxWords).join(" ")}…`;
}

export function bioWordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
}

export function buildDraftBio(d: VendorOnboardingData, variant: number): string {
  const services =
    d.servicesOffered.length > 0 ? d.servicesOffered.join(", ") : "event services";
  const events = formatEventTypesForBio(d.eventTypes);
  const city = d.baseCity || "the UK";
  const biz = d.businessName || "Our business";
  const draft =
    variant % 2 === 0
      ? `${biz} brings authentic ${services} to ${events} across ${city}. We focus on cultural detail, reliable communication, and memorable experiences.`
      : `Based in ${city}, ${biz} specialises in ${services} for ${events}, with professional delivery and warm, collaborative planning from enquiry to event day.`;
  return clampBioWords(draft);
}

export function validateStep(step: number, d: VendorOnboardingData): string | null {
  switch (step) {
    case 1:
      if (!d.firstName.trim() || !d.lastName.trim()) return "Enter your name.";
      if (!d.phone.trim()) return "Enter your phone number.";
      return null;
    case 2:
      if (!d.businessName.trim()) return "Enter your business name.";
      if (d.servicesOffered.length === 0) return "Select at least one service.";
      if (d.eventTypes.length === 0) return "Select at least one event type.";
      return null;
    case 3:
      if (!d.baseCity.trim()) return "Enter your base city.";
      if (d.deliveryModes.length === 0) {
        return "Choose at least one way your service is provided.";
      }
      if (!d.travelRadius) return "Select how far you can travel or deliver (miles).";
      if (!d.travelDeliveryPolicy) {
        return "Select a default travel / delivery option.";
      }
      if (
        d.travelDeliveryPolicy === "custom" &&
        !d.travelDeliveryPolicyCustomText.trim()
      ) {
        return "Describe your custom travel / delivery rule.";
      }
      return null;
    case 4: {
      const hasPackagePrice = d.packages.some((p) => p.price.trim());
      if (!d.hourlyRate.trim() && !d.dailyRate.trim() && !hasPackagePrice) {
        return "Add at least one rate or a package price.";
      }
      for (const p of d.packages) {
        const hasAny =
          p.title.trim() || p.price.trim() || p.details.trim() || p.duration.trim();
        if (hasAny && (!p.title.trim() || !p.price.trim())) {
          return "Each package needs a name and a price.";
        }
      }
      return null;
    }
    case 5:
      if (d.availableWeekdays.length === 0) return "Pick at least one weekday.";
      if (!d.maxBookingsPerDay || Number(d.maxBookingsPerDay) < 1) {
        return "Set max bookings per day (min 1).";
      }
      return null;
    case 6: {
      const portfolioUnique = new Set([
        ...d.portfolioFileNamesPersisted,
        ...d.portfolioFiles.map((f) => f.name),
      ]);
      if (portfolioUnique.size < 5) return "Upload at least 5 images (max 20).";
      if (portfolioUnique.size > 20) return "Maximum 20 images.";
      return null;
    }
    case 7:
      if (!d.stripeConnectStarted) {
        return "Start Stripe Connect verification to continue.";
      }
      return null;
    case 8:
      // Additional info is entirely optional — nothing to validate.
      return null;
    case 9: {
      if (!d.confirmTruthful || !d.confirmTerms) {
        return "Confirm the checkboxes to submit.";
      }
      if (bioWordCount(d.aiBioDraft) > BIO_MAX_WORDS) {
        return `Shorten your bio to ${BIO_MAX_WORDS} words or fewer.`;
      }
      return null;
    }
    default:
      return null;
  }
}
