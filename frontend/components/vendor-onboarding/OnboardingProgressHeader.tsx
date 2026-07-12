"use client";

import { Clock, CloudUpload } from "lucide-react";
import {
  formatMinuteEstimate,
  onboardingEncouragement,
  ONBOARDING_FORM_STEP_COUNT,
  onboardingMinutesRemaining,
  onboardingProgressPercent,
  onboardingStepLabel,
  onboardingDurationRangeLabel,
} from "./onboardingProgress";

type OnboardingProgressHeaderProps = {
  step: number;
  saving?: boolean;
};

export function OnboardingProgressHeader({ step, saving = false }: OnboardingProgressHeaderProps) {
  if (step < 1 || step > ONBOARDING_FORM_STEP_COUNT) return null;

  const percent = onboardingProgressPercent(step);
  const minutesLeft = onboardingMinutesRemaining(step);
  const label = onboardingStepLabel(step);
  const encouragement = onboardingEncouragement(step);
  const durationRange = onboardingDurationRangeLabel();

  return (
    <div className="mb-0 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <p className="text-sm font-semibold text-neutral-900">
            Step {step} of {ONBOARDING_FORM_STEP_COUNT}
          </p>
          <span className="hidden text-neutral-300 sm:inline" aria-hidden>
            ·
          </span>
          <p className="text-sm text-neutral-600">{label}</p>
        </div>
        <p className="text-xs font-medium text-primary">{percent}% complete</p>
      </div>

      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-100"
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

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-neutral-500">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden />
          {formatMinuteEstimate(minutesLeft)}
          <span className="hidden text-neutral-400 sm:inline">
            ({durationRange} total)
          </span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CloudUpload className="h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden />
          {saving ? "Saving…" : "Progress saves when you tap Next"}
        </span>
      </div>

      <p className="rounded-xl bg-primary/5 px-3.5 py-2.5 text-sm leading-relaxed text-neutral-700 ring-1 ring-primary/10">
        {encouragement}
      </p>
    </div>
  );
}
