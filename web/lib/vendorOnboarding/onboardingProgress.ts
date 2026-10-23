import { STEP_LABELS } from "./constants";

/**
 * Wizard step numbers, persisted as `current_step`. Form steps are 1-9; the submitted screen is 10.
 * Flow version 3 inserted the cancellation policy as step 5.
 */
export const ONBOARDING_STEP = {
  account: 1,
  business: 2,
  location: 3,
  pricing: 4,
  cancellation: 5,
  availability: 6,
  portfolio: 7,
  additionalInfo: 8,
  review: 9,
  submitted: 10,
} as const;

/** Form steps 1-9; step 10 is the submitted screen. */
export const ONBOARDING_FORM_STEP_COUNT = ONBOARDING_STEP.review;

/** Saved forms carry this `onboardingFlowVersion`; older versions are remapped on load. */
export const ONBOARDING_FLOW_VERSION = 3;

/** Rough minutes per step (helps set expectations, not a SLA). */
export const STEP_ESTIMATED_MINUTES: readonly number[] = [
  1, // Account
  1, // Business
  1, // Location
  2, // Pricing
  1, // Cancellation policy
  1, // Availability
  3, // Portfolio
  1, // Additional info
  1, // Review
];

/** Shown in copy - range feels more honest than a precise sum of guesses. */
export function onboardingDurationRangeLabel(): string {
  return "10-15 minutes";
}

export function onboardingTotalEstimatedMinutes(): number {
  return STEP_ESTIMATED_MINUTES.reduce((sum, n) => sum + n, 0);
}

export function onboardingProgressPercent(step: number): number {
  if (step < 1) return 0;
  if (step >= ONBOARDING_FORM_STEP_COUNT) return 100;
  return Math.round((step / ONBOARDING_FORM_STEP_COUNT) * 100);
}

export function onboardingMinutesRemaining(step: number): number {
  if (step < 1 || step > ONBOARDING_FORM_STEP_COUNT) return 0;
  return STEP_ESTIMATED_MINUTES.slice(step - 1).reduce((sum, n) => sum + n, 0);
}

export function formatMinuteEstimate(minutes: number): string {
  if (minutes <= 1) return "About 1 min left";
  return `About ${minutes} min left`;
}

export function onboardingStepLabel(step: number): string {
  const idx = step - 1;
  if (idx < 0 || idx >= STEP_LABELS.length) return "";
  return STEP_LABELS[idx] ?? "";
}

export function onboardingEncouragement(step: number): string {
  if (step === 1) {
    return `Takes about ${onboardingDurationRangeLabel()}. Your progress is saved.`;
  }
  if (step <= ONBOARDING_STEP.location) return "Short steps. Come back anytime.";
  if (step <= ONBOARDING_STEP.availability) return "Good progress.";
  if (step <= ONBOARDING_STEP.portfolio) return "Nearly there.";
  if (step === ONBOARDING_STEP.additionalInfo) return "Last few optional details.";
  return "Final check, then submit.";
}

/**
 * Map a saved `current_step` onto the current numbering (see `ONBOARDING_STEP`).
 * Version 1 had 9 form steps (Verification at 7, submitted at 10); version 2 had 8 form
 * steps without the cancellation step (submitted at 9). No-op when `flowVersion >= 3`.
 */
export function mapLegacyOnboardingStep(currentStep: number, flowVersion: number): number {
  const maxStep = ONBOARDING_STEP.submitted;
  if (flowVersion >= ONBOARDING_FLOW_VERSION) {
    return Math.min(Math.max(currentStep, 1), maxStep);
  }
  let version2Step = currentStep;
  if (flowVersion < 2) {
    // v1: 1-6 same, 7=Verification, 8=Additional, 9=Review, 10=Submitted
    // v2: 1-6 same, 7=Additional, 8=Review, 9=Submitted
    if (currentStep === 7 || currentStep === 8) version2Step = 7;
    else if (currentStep === 9) version2Step = 8;
    else if (currentStep >= 10) version2Step = 9;
  }
  // v2 to v3: Cancellation policy became step 5, so steps 5-9 each move up by one.
  const mapped = version2Step >= 5 ? version2Step + 1 : version2Step;
  return Math.min(Math.max(mapped, 1), maxStep);
}

export type OnboardingStepProfile = {
  onboarding_status?: string;
  approval_status?: string;
  current_step?: number;
  returnedForEditsAt?: string;
};

/**
 * Admin returned a submitted profile to draft so the vendor can edit again.
 * Submitted profiles are never “returned” — a leftover timestamp after resubmit
 * would fight the pending-review lock and bounce step 8 ↔ 9.
 */
export function isReturnedForEdits(profile: OnboardingStepProfile): boolean {
  if (profile.onboarding_status === "submitted") return false;
  if (profile.approval_status === "approved" || profile.approval_status === "banned") {
    return false;
  }
  if (profile.returnedForEditsAt?.trim()) return true;
  // Stale submitted-screen step after an unsubmit that predates the timestamp.
  return profile.onboarding_status === "draft" && (profile.current_step ?? 0) >= ONBOARDING_STEP.submitted;
}

/**
 * Pending-review lock still allows form patches when the vendor must add
 * portfolio photos before admin can continue the review.
 */
export function canApplyOnboardingFormUpdate(opts: {
  lockedPendingReview: boolean;
  canAddPortfolioWhilePending: boolean;
}): boolean {
  if (!opts.lockedPendingReview) return true;
  return opts.canAddPortfolioWhilePending;
}

/** Wizard step after loading profile — keeps draft vendors off the submitted screen. */
export function resolveOnboardingStepFromProfile(
  profile: OnboardingStepProfile,
  flowVersion: number,
  isWalkthrough: boolean,
): number {
  if (profile.onboarding_status === "submitted") {
    return isWalkthrough ? 1 : profile.approval_status === "approved" ? 1 : ONBOARDING_STEP.submitted;
  }
  const mapped = mapLegacyOnboardingStep(profile.current_step ?? 1, flowVersion);
  // Admin returned profile to draft; saved step may still point at submitted/review.
  if (mapped >= ONBOARDING_STEP.submitted) return ONBOARDING_STEP.review;
  return mapped;
}
