import { STEP_COPY } from "../onboardingCopy";
import { ONBOARDING_FORM_STEP_COUNT } from "../onboardingProgress";
import { OnboardingStepInfoTrigger } from "./OnboardingStepInfoModal";

type OnboardingWizardStepTitleProps = {
  step: number;
  servicesOffered?: string[];
  onOpenStepInfo?: () => void;
};

/** Broad step headline at the top of the questionnaire card (wizard layout only). */
export function OnboardingWizardStepTitle({
  step,
  servicesOffered = [],
  onOpenStepInfo,
}: OnboardingWizardStepTitleProps) {
  if (step < 1 || step > ONBOARDING_FORM_STEP_COUNT) return null;

  const copy = STEP_COPY[step as keyof typeof STEP_COPY];
  const lead = "lead" in copy ? copy.lead : undefined;

  return (
    <header className="mb-8 space-y-2 border-b border-neutral-100 pb-6">
      {lead ? <p className="text-base font-semibold text-primary">{lead}</p> : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="font-heading text-2xl font-semibold leading-snug text-neutral-900 sm:text-3xl">
          {copy.headline}
        </h2>
        {onOpenStepInfo ? (
          <OnboardingStepInfoTrigger
            step={step}
            servicesOffered={servicesOffered}
            onOpen={onOpenStepInfo}
          />
        ) : null}
      </div>
      {copy.subtext ? (
        <p className="max-w-2xl text-sm leading-relaxed text-neutral-600">{copy.subtext}</p>
      ) : null}
    </header>
  );
}
