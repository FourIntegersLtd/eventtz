"use client";

import {
  ONBOARDING_FORM_STEP_COUNT,
  onboardingProgressPercent,
} from "./onboardingProgress";

type OnboardingProgressHeaderProps = {
  step: number;
};

export function OnboardingProgressHeader({ step }: OnboardingProgressHeaderProps) {
  if (step < 1 || step > ONBOARDING_FORM_STEP_COUNT) return null;

  const percent = onboardingProgressPercent(step);

  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-neutral-100"
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Onboarding progress, step ${step} of ${ONBOARDING_FORM_STEP_COUNT}`}
    >
      <div
        className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
