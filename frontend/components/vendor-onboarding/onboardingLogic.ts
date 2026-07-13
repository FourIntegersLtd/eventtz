import {
  EVENT_TYPE_IDS_ALL,
  EVENT_TYPE_OPTIONS,
  MAX_DISCOUNT_PCT,
  MAX_MAX_BOOKINGS_PER_DAY,
  MAX_MONEY_GBP,
  MIN_MAX_BOOKINGS_PER_DAY,
} from "./constants";
import type { VendorOnboardingData } from "./types";
import { parseMoneyNumber } from "@/lib/vendorDiscountDisplay";
import { portfolioFileKey } from "@/lib/portfolioFileKey";

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

function moneyInRange(raw: string, label: string, required = false): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return required ? `${label} is required.` : null;
  }
  const n = parseMoneyNumber(trimmed);
  if (n === null) return `${label} must be a valid amount.`;
  if (n < 0 || n > MAX_MONEY_GBP) return `${label} is out of allowed range.`;
  return null;
}

function pctInRange(raw: string, label: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = parseMoneyNumber(trimmed);
  if (n === null) return `${label} must be a valid number.`;
  if (n < 0 || n > MAX_DISCOUNT_PCT) {
    return `${label} must be between 0 and ${MAX_DISCOUNT_PCT}%.`;
  }
  return null;
}

export function validateStepErrors(step: number, d: VendorOnboardingData): string[] {
  const errors: string[] = [];

  switch (step) {
    case 1:
      if (!d.firstName.trim()) errors.push("First name");
      if (!d.lastName.trim()) errors.push("Last name");
      if (!d.phone.trim()) errors.push("Phone number");
      break;
    case 2:
      if (!d.businessName.trim()) errors.push("Business name");
      if (d.servicesOffered.length === 0) errors.push("Service category");
      else if (d.servicesOffered.includes("other")) {
        errors.push("A listed service category (Other is not available yet)");
      }
      if (d.eventTypes.length === 0) errors.push("At least one event type");
      break;
    case 3:
      if (!d.baseCity.trim()) errors.push("Base city");
      if (d.deliveryModes.length === 0) {
        errors.push("How your service is provided");
      }
      if (!d.travelRadius) errors.push("Travel or delivery radius");
      if (!d.travelDeliveryPolicy) {
        errors.push("Default travel / delivery option");
      }
      if (
        d.travelDeliveryPolicy === "custom" &&
        !d.travelDeliveryPolicyCustomText.trim()
      ) {
        errors.push("Custom travel / delivery rule description");
      }
      break;
    case 4: {
      const hourlyErr = moneyInRange(d.hourlyRate, "Hourly rate");
      if (hourlyErr) errors.push(hourlyErr.replace(/\.$/, ""));
      const dailyErr = moneyInRange(d.dailyRate, "Daily rate");
      if (dailyErr) errors.push(dailyErr.replace(/\.$/, ""));

      const hasPackagePrice = d.packages.some((p) => p.price.trim());
      if (!d.hourlyRate.trim() && !d.dailyRate.trim() && !hasPackagePrice) {
        errors.push("At least one rate or package price");
      }
      for (const p of d.packages) {
        const hasAny =
          p.title.trim() || p.price.trim() || p.details.trim() || p.duration.trim();
        if (hasAny && (!p.title.trim() || !p.price.trim())) {
          errors.push("Each package needs a name and a price");
          break;
        }
        if (p.price.trim()) {
          const pkgErr = moneyInRange(p.price, "Package price", true);
          if (pkgErr) errors.push(pkgErr.replace(/\.$/, ""));
        }
      }
      if (d.offerDiscounts) {
        for (const [raw, label] of [
          [d.discountPercentage, "List discount"],
          [d.bulkDiscountPercent, "Bulk discount"],
          [d.offPeakDiscountPercent, "Off-peak discount"],
        ] as const) {
          const err = pctInRange(raw, label);
          if (err) errors.push(err.replace(/\.$/, ""));
        }
        const bulkErr = moneyInRange(d.bulkDiscountThreshold, "Bulk threshold");
        if (bulkErr) errors.push(bulkErr.replace(/\.$/, ""));
      }
      break;
    }
    case 5:
      if (d.availableWeekdays.length === 0) errors.push("At least one weekday");
      if (!d.maxBookingsPerDay) {
        errors.push("Max bookings per day");
      } else {
        const n = parseMoneyNumber(String(d.maxBookingsPerDay).trim());
        if (
          n === null ||
          n < MIN_MAX_BOOKINGS_PER_DAY ||
          n > MAX_MAX_BOOKINGS_PER_DAY ||
          !Number.isInteger(n)
        ) {
          errors.push(
            `Max bookings per day (${MIN_MAX_BOOKINGS_PER_DAY}–${MAX_MAX_BOOKINGS_PER_DAY})`,
          );
        }
      }
      break;
    case 6: {
      const portfolioUnique = new Set([
        ...d.portfolioFileNamesPersisted,
        ...d.portfolioFiles.map((f) => portfolioFileKey(f)),
      ]);
      if (portfolioUnique.size < 5) errors.push("At least 5 portfolio images");
      if (portfolioUnique.size > 20) errors.push("No more than 20 portfolio images");
      break;
    }
    case 7:
      if (!d.stripeConnectStarted) {
        errors.push("Stripe Connect verification");
      }
      break;
    case 8:
      break;
    case 9:
      if (!d.confirmTruthful) {
        errors.push("Confirmation that details are truthful");
      }
      if (!d.confirmTerms) {
        errors.push("Acceptance of Terms & Conditions");
      }
      if (bioWordCount(d.aiBioDraft) > BIO_MAX_WORDS) {
        errors.push(`Public bio (${BIO_MAX_WORDS} words or fewer)`);
      }
      break;
    default:
      break;
  }

  return errors;
}

export function formatStepValidationErrors(errors: string[]): string | null {
  if (errors.length === 0) return null;
  if (errors.length === 1) return `Missing or incomplete: ${errors[0]}.`;
  return `Please complete the following:\n${errors.map((e) => `• ${e}`).join("\n")}`;
}

export function validateStep(step: number, d: VendorOnboardingData): string | null {
  return formatStepValidationErrors(validateStepErrors(step, d));
}
