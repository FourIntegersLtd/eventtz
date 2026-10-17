import { z } from "zod";
import {
  MAX_DISCOUNT_PCT,
  MAX_MONEY_GBP,
  MAX_MAX_BOOKINGS_PER_DAY,
  MAX_PORTFOLIO_IMAGES,
  MIN_MAX_BOOKINGS_PER_DAY,
  MIN_MONEY_GBP,
  MIN_PORTFOLIO_IMAGES,
} from "@/features/vendor/onboarding/constants";
import type { VendorOnboardingData } from "@/features/vendor/onboarding/types";
import { portfolioFileKey } from "@/lib/portfolioFileKey";
import { phoneRequiredSchema } from "@/lib/validation/phone";
import {
  countCompletePackages,
  isConfiguredPackage,
  isCompletePackage,
  packageValidationErrors,
  requiresAtLeastOnePackage,
  servicesRequiringPackages,
} from "@/features/vendor/onboarding/packageQuality";
import { CANCELLATION_POLICY_KEYS } from "@/features/bookings/cancellationPolicyCopy";
import { parseMoneyNumber } from "@/lib/vendorDiscountDisplay";
import {
  addSingleGbpAmountIssue,
  singleGbpAmountFieldError,
} from "@/lib/validation/money";

import {
  damageDepositError,
  deliverySplitErrors,
  offersDamageDeposit,
  offersDeliverySplit,
} from "@/features/bookings/bookingTerms";

const vendorDataSchema = z.custom<VendorOnboardingData>(
  (d) => d != null && typeof d === "object",
  "Invalid onboarding data.",
);

function bioWordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
}

const BIO_MAX_WORDS = 100;

/** Returns a step-banner label/message, or null when valid. */
function pctFieldError(
  raw: string,
  label: string,
): string | null {
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

function portfolioImageCount(d: VendorOnboardingData): number {
  return new Set([
    ...d.portfolioFileNamesPersisted,
    ...d.portfolioFiles.map((f) => portfolioFileKey(f)),
  ]).size;
}

function addPortfolioImageCountIssues(d: VendorOnboardingData, ctx: z.RefinementCtx) {
  const count = portfolioImageCount(d);
  if (count < MIN_PORTFOLIO_IMAGES) {
    addIssue(ctx, `At least ${MIN_PORTFOLIO_IMAGES} portfolio photos`);
  }
  if (count > MAX_PORTFOLIO_IMAGES) {
    addIssue(ctx, `No more than ${MAX_PORTFOLIO_IMAGES} portfolio images`);
  }
}

const step1Schema = vendorDataSchema.superRefine((d, ctx) => {
  if (!d.firstName.trim()) addIssue(ctx, "First name");
  if (!d.lastName.trim()) addIssue(ctx, "Last name");
  const phoneResult = phoneRequiredSchema.safeParse(d.phone);
  if (!phoneResult.success) {
    addIssue(ctx, phoneResult.error.issues[0]?.message ?? "Valid phone number");
  }
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
  if (!(CANCELLATION_POLICY_KEYS as readonly string[]).includes(d.cancellationPolicy)) {
    addIssue(ctx, "Cancellation policy");
  }
  addSingleGbpAmountIssue(ctx, d.hourlyRate, "Hourly rate", { required: false, max: MAX_MONEY_GBP });
  addSingleGbpAmountIssue(ctx, d.dailyRate, "Daily rate", { required: false, max: MAX_MONEY_GBP });

  if (offersDeliverySplit(d.servicesOffered)) {
    const split = deliverySplitErrors(d.deliveryUpfrontPercent, d.deliveryDeadlineDays);
    if (split.upfront) addIssue(ctx, split.upfront);
    if (split.deadline) addIssue(ctx, split.deadline);
  }
  if (offersDamageDeposit(d.servicesOffered)) {
    const depositError = damageDepositError(d.damageDepositGbp);
    if (depositError) addIssue(ctx, depositError);
  }

  const completePackages = d.packages.filter(
    (p) => isConfiguredPackage(p) && isCompletePackage(p),
  );
  const hasPackagePrice = d.packages.some((p) => p.price.trim());
  if (!d.hourlyRate.trim() && !d.dailyRate.trim() && !hasPackagePrice) {
    addIssue(ctx, "At least one rate or package price");
  }

  if (requiresAtLeastOnePackage(d.servicesOffered) && completePackages.length === 0) {
    const labels = servicesRequiringPackages(d.servicesOffered).join(", ");
    addIssue(ctx, `Add at least one complete package for ${labels}`);
  }

  for (const p of d.packages) {
    if (!isConfiguredPackage(p)) continue;
    const pkgErrors = packageValidationErrors(p, { strict: true });
    for (const message of pkgErrors) {
      addIssue(ctx, message);
    }
  }

  if (d.offerDiscounts) {
    if (!d.discountLabel.trim()) addIssue(ctx, "Discount name");
    const hasList = d.discountPercentage.trim().length > 0;
    const hasBulk =
      d.bulkDiscountThreshold.trim().length > 0 && d.bulkDiscountPercent.trim().length > 0;
    const hasOffPeak = d.offPeakDiscountPercent.trim().length > 0;
    if (!hasList && !hasBulk && !hasOffPeak) {
      addIssue(ctx, "At least one discount option");
    }
    if (
      (d.bulkDiscountThreshold.trim() && !d.bulkDiscountPercent.trim()) ||
      (!d.bulkDiscountThreshold.trim() && d.bulkDiscountPercent.trim())
    ) {
      addIssue(ctx, "Bulk discount needs a threshold and a percentage");
    }
    for (const [raw, label] of [
      [d.discountPercentage, "List discount"],
      [d.bulkDiscountPercent, "Bulk discount"],
      [d.offPeakDiscountPercent, "Off-peak discount"],
    ] as const) {
      const err = pctFieldError(raw, label);
      if (err) addIssue(ctx, err);
    }
    addSingleGbpAmountIssue(ctx, d.bulkDiscountThreshold, "Bulk threshold", {
      required: false,
      max: MAX_MONEY_GBP,
    });
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
        `Max bookings per day (${MIN_MAX_BOOKINGS_PER_DAY}-${MAX_MAX_BOOKINGS_PER_DAY})`,
      );
    }
  }
});

const step6Schema = vendorDataSchema.superRefine((d, ctx) => {
  addPortfolioImageCountIssues(d, ctx);
});

const step8Schema = vendorDataSchema.superRefine((d, ctx) => {
  addPortfolioImageCountIssues(d, ctx);
  if (!d.profileImageUrl.trim()) {
    addIssue(ctx, "Add a profile photo before submitting");
  }
  if (requiresAtLeastOnePackage(d.servicesOffered)) {
    const complete = countCompletePackages(d.packages);
    if (complete === 0) {
      const labels = servicesRequiringPackages(d.servicesOffered).join(", ");
      addIssue(ctx, `Add at least one complete package for ${labels}`);
    }
  }
  for (const p of d.packages) {
    if (!isConfiguredPackage(p)) continue;
    const pkgErrors = packageValidationErrors(p, { strict: true });
    for (const message of pkgErrors) {
      addIssue(ctx, message);
    }
  }
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
  8: step8Schema,
};

/** Step-banner error labels/messages for vendor onboarding (steps 1-8). */
export function vendorOnboardingStepErrors(step: number, d: VendorOnboardingData): string[] {
  const schema = STEP_SCHEMAS[step];
  if (!schema) return [];
  const result = schema.safeParse(d);
  if (result.success) return [];
  return result.error.issues.map((issue) => issue.message);
}
