import { STEP_LABELS } from "./constants";

/** Form steps 1–8; step 9 is the submitted screen. */
export const ONBOARDING_FORM_STEP_COUNT = 8;

/** Rough minutes per step (helps set expectations, not a SLA). */
export const STEP_ESTIMATED_MINUTES: readonly number[] = [
  1, // Account
  1, // Business
  1, // Location
  2, // Pricing
  1, // Availability
  3, // Portfolio
  1, // Additional info
  1, // Review
];

/** Shown in copy — range feels more honest than a precise sum of guesses. */
export function onboardingDurationRangeLabel(): string {
  return "10–15 minutes";
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
  if (step <= 3) return "Short steps. Come back anytime.";
  if (step <= 5) return "Good progress.";
  if (step <= 6) return "Nearly there.";
  if (step === 7) return "Last few optional details.";
  return "Final check, then submit.";
}

/**
 * Map saved `current_step` from the pre–Stripe-removal wizard
 * (9 form steps + submitted=10, with Verification at 7) onto the current
 * numbering (8 form steps + submitted=9). No-op when `onboardingFlowVersion >= 2`.
 */
export function mapLegacyOnboardingStep(currentStep: number, flowVersion: number): number {
  if (flowVersion >= 2) {
    return Math.min(Math.max(currentStep, 1), 9);
  }
  // Old: 1–6 same, 7=Verification, 8=Additional, 9=Review, 10=Submitted
  // New: 1–6 same, 7=Additional, 8=Review, 9=Submitted
  if (currentStep <= 6) return currentStep;
  if (currentStep === 7 || currentStep === 8) return 7;
  if (currentStep === 9) return 8;
  if (currentStep >= 10) return 9;
  return Math.min(Math.max(currentStep, 1), 8);
}
