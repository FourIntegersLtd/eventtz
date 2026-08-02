import { STEP_COPY } from "../onboardingCopy";

type OnboardingWizardStepTitleProps = {
  step: number;
};

/** Broad step headline at the top of the questionnaire card (wizard layout only). */
export function OnboardingWizardStepTitle({ step }: OnboardingWizardStepTitleProps) {
  if (step < 1 || step > 8) return null;

  const copy = STEP_COPY[step as keyof typeof STEP_COPY];
  const lead = "lead" in copy ? copy.lead : undefined;

  return (
    <header className="mb-8 space-y-2 border-b border-neutral-100 pb-6">
      {lead ? <p className="text-base font-semibold text-primary">{lead}</p> : null}
      <h2 className="font-heading text-2xl font-semibold leading-snug text-neutral-900 sm:text-3xl">
        {copy.headline}
      </h2>
      {copy.subtext ? (
        <p className="max-w-2xl text-sm leading-relaxed text-neutral-600">{copy.subtext}</p>
      ) : null}
    </header>
  );
}
