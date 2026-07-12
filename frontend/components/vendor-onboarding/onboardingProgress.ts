import { STEP_LABELS } from "./constants";

/** Form steps 1–9; step 10 is the submitted screen. */
export const ONBOARDING_FORM_STEP_COUNT = 9;

/** Rough minutes per step (helps set expectations, not a SLA). */
export const STEP_ESTIMATED_MINUTES: readonly number[] = [
  1, // Account
  1, // Business
  1, // Location
  2, // Pricing
  1, // Availability
  3, // Portfolio
  2, // Verification
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
    return `Most vendors finish in ${onboardingDurationRangeLabel()}. You can stop anytime — we save your progress.`;
  }
  if (step <= 3) return "Short steps. No rush — come back later if you need to.";
  if (step <= 5) return "Nice progress so far. Most of the heavy lifting is behind you.";
  if (step <= 7) return "Over halfway. A few quick sections left.";
  if (step === 8) return "Almost there — documents and optional extras.";
  return "Last step — check everything looks right, then submit.";
}
