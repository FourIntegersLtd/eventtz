import { EVENT_TYPE_OPTIONS } from "./constants";
import type { VendorOnboardingData } from "./types";
import { marketLocationFallback } from "@/lib/markets";
import { displayServicesOffered } from "@/features/client/browse/browseLabels";
import { normalizePublicBioText } from "@/features/vendor/onboarding/reviewDisplayHelpers";
import { vendorOnboardingStepErrors } from "@/features/vendor/onboarding/vendorOnboardingValidation";

const BIO_MAX_WORDS = 60;

function formatEventTypesForBio(types: string[]): string {
  if (types.length === 0) return "celebrations";
  if (types.includes("all")) {
    return EVENT_TYPE_OPTIONS.find((o) => o.value === "all")?.label ?? "all event types";
  }
  return types
    .filter((t) => t !== "all")
    .map((t) => EVENT_TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t.replace(/_/g, " "))
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
    d.servicesOffered.length > 0
      ? displayServicesOffered(d.servicesOffered).join(", ").toLowerCase()
      : "event services";
  const events = formatEventTypesForBio(d.eventTypes).toLowerCase();
  const city = d.baseCity || marketLocationFallback(d.countryCode);
  const biz = d.businessName || "Our business";
  const draft =
    variant % 2 === 0
      ? `${biz} brings ${services} to ${events} across ${city}. We focus on cultural detail, reliable communication, and memorable experiences.`
      : `Based in ${city}, ${biz} specialises in ${services} for ${events}, with professional delivery and warm, collaborative planning from enquiry to event day.`;
  return normalizePublicBioText(clampBioWords(draft));
}

export function validateStepErrors(step: number, d: VendorOnboardingData): string[] {
  return vendorOnboardingStepErrors(step, d);
}

export function formatStepValidationErrors(errors: string[]): string | null {
  if (errors.length === 0) return null;
  if (errors.length === 1) return `Missing or incomplete: ${errors[0]}.`;
  return `Please complete the following:\n${errors.map((e) => `• ${e}`).join("\n")}`;
}

export function validateStep(step: number, d: VendorOnboardingData): string | null {
  return formatStepValidationErrors(validateStepErrors(step, d));
}
