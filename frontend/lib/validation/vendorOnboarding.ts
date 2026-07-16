import { z } from "zod";
import {
  MAX_DISCOUNT_PCT,
  MAX_MONEY_GBP,
  MAX_MAX_BOOKINGS_PER_DAY,
  MIN_MAX_BOOKINGS_PER_DAY,
} from "@/components/vendor-onboarding/constants";
import type { VendorOnboardingData } from "@/components/vendor-onboarding/types";
import { portfolioFileKey } from "@/lib/portfolioFileKey";
import { parseMoneyNumber } from "@/lib/vendorDiscountDisplay";

const BIO_MAX_WORDS = 60;
const MAX_PORTFOLIO_IMAGES = 20;

const vendorDataSchema = z.custom<VendorOnboardingData>(
  (d) => d != null && typeof d === "object",
  "Invalid onboarding data.",
);

function bioWordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
}

/** Returns a step-banner label/message, or null when valid. */
function moneyFieldError(raw: string, label: string, required = false): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return required ? `${label} is required` : null;
  }
  const n = parseMoneyNumber(trimmed);
  if (n === null) return `${label} must be a valid amount`;
  if (n < 0 || n > MAX_MONEY_GBP) return `${label} is out of allowed range`;
  return null;
}

/** Returns a step-banner label/message, or null when valid. */
function pctFieldError(raw: string, label: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = parseMoneyNumber(trimmed);
  if (n === null) return `${label} must be a valid number`;
  if (n < 0 || n > MAX_DISCOUNT_PCT) {
    return `${label} must be between 0 and ${MAX_DISCOUNT_PCT}%`;
  }
  return null;
}

function addIssue(ctx: z.RefinementCtx, message: string) {
  ctx.addIssue({ code: z.ZodIssueCode.custom, message });
}

const step1Schema = vendorDataSchema.superRefine((d, ctx) => {
  if (!d.firstName.trim()) addIssue(ctx, "First name");
  if (!d.lastName.trim()) addIssue(ctx, "Last name");
  if (!d.phone.trim()) addIssue(ctx, "Phone number");
});

const step2Schema = vendorDataSchema.superRefine((d, ctx) => {
  if (!d.businessName.trim()) addIssue(ctx, "Business name");
  if (d.servicesOffered.length === 0) {
    addIssue(ctx, "Service category");
  } else if (d.servicesOffered.includes("other")) {
    addIssue(ctx, "A listed service category (Other is not available yet)");
  }
  if (d.eventTypes.length === 0) addIssue(ctx, "At least one event type");
});

const step3Schema = vendorDataSchema.superRefine((d, ctx) => {
  if (!d.baseCity.trim()) addIssue(ctx, "Base city");
  if (d.deliveryModes.length === 0) addIssue(ctx, "How your service is provided");
  if (!d.travelRadius) addIssue(ctx, "Travel or delivery radius");
  if (!d.travelDeliveryPolicy) addIssue(ctx, "Default travel / delivery option");
  if (d.travelDeliveryPolicy === "custom" && !d.travelDeliveryPolicyCustomText.trim()) {
    addIssue(ctx, "Custom travel / delivery rule description");
  }
});

const step4Schema = vendorDataSchema.superRefine((d, ctx) => {
  const hourlyErr = moneyFieldError(d.hourlyRate, "Hourly rate");
  if (hourlyErr) addIssue(ctx, hourlyErr);

  const dailyErr = moneyFieldError(d.dailyRate, "Daily rate");
  if (dailyErr) addIssue(ctx, dailyErr);

  const hasPackagePrice = d.packages.some((p) => p.price.trim());
  if (!d.hourlyRate.trim() && !d.dailyRate.trim() && !hasPackagePrice) {
    addIssue(ctx, "At least one rate or package price");
  }

  for (const p of d.packages) {
    const hasAny =
      p.title.trim() || p.price.trim() || p.details.trim() || p.duration.trim();
    if (hasAny && (!p.title.trim() || !p.price.trim())) {
      addIssue(ctx, "Each package needs a name and a price");
      break;
    }
    if (p.price.trim()) {
      const pkgErr = moneyFieldError(p.price, "Package price", true);
      if (pkgErr) addIssue(ctx, pkgErr);
    }
  }

  if (d.offerDiscounts) {
    for (const [raw, label] of [
      [d.discountPercentage, "List discount"],
      [d.bulkDiscountPercent, "Bulk discount"],
      [d.offPeakDiscountPercent, "Off-peak discount"],
    ] as const) {
      const err = pctFieldError(raw, label);
      if (err) addIssue(ctx, err);
    }
    const bulkErr = moneyFieldError(d.bulkDiscountThreshold, "Bulk threshold");
    if (bulkErr) addIssue(ctx, bulkErr);
  }
});

const step5Schema = vendorDataSchema.superRefine((d, ctx) => {
  if (d.availableWeekdays.length === 0) addIssue(ctx, "At least one weekday");
  if (!d.maxBookingsPerDay) {
    addIssue(ctx, "Max bookings per day");
  } else {
    const n = parseMoneyNumber(String(d.maxBookingsPerDay).trim());
    if (
      n === null ||
      n < MIN_MAX_BOOKINGS_PER_DAY ||
      n > MAX_MAX_BOOKINGS_PER_DAY ||
      !Number.isInteger(n)
    ) {
      addIssue(
        ctx,
        `Max bookings per day (${MIN_MAX_BOOKINGS_PER_DAY}–${MAX_MAX_BOOKINGS_PER_DAY})`,
      );
    }
  }
});

const step6Schema = vendorDataSchema.superRefine((d, ctx) => {
  const portfolioUnique = new Set([
    ...d.portfolioFileNamesPersisted,
    ...d.portfolioFiles.map((f) => portfolioFileKey(f)),
  ]);
  if (portfolioUnique.size > MAX_PORTFOLIO_IMAGES) {
    addIssue(ctx, "No more than 20 portfolio images");
  }
});

const step7Schema = vendorDataSchema.superRefine((d, ctx) => {
  if (!d.stripeConnectStarted) addIssue(ctx, "Stripe Connect verification");
});

const step9Schema = vendorDataSchema.superRefine((d, ctx) => {
  if (!d.confirmTruthful) addIssue(ctx, "Confirmation that details are truthful");
  if (!d.confirmTerms) addIssue(ctx, "Acceptance of Terms & Conditions");
  if (bioWordCount(d.aiBioDraft) > BIO_MAX_WORDS) {
    addIssue(ctx, `Public bio (${BIO_MAX_WORDS} words or fewer)`);
  }
});

const STEP_SCHEMAS: Partial<Record<number, z.ZodType<VendorOnboardingData>>> = {
  1: step1Schema,
  2: step2Schema,
  3: step3Schema,
  4: step4Schema,
  5: step5Schema,
  6: step6Schema,
  7: step7Schema,
  9: step9Schema,
};

/** Step-banner error labels/messages for vendor onboarding (steps 1–9). */
export function vendorOnboardingStepErrors(step: number, d: VendorOnboardingData): string[] {
  const schema = STEP_SCHEMAS[step];
  if (!schema) return [];
  const result = schema.safeParse(d);
  if (result.success) return [];
  return result.error.issues.map((issue) => issue.message);
}
