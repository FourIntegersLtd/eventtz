import { PartyPopper } from "lucide-react";
import { LottieIllustration } from "@/components/ui/LottieIllustration";
import type { VendorOnboardingData, VendorOnboardingUpdate } from "../types";
import { STEP_COPY } from "../onboardingCopy";
import {
  OnboardingQuestionLayout,
  OnboardingSubQuestion,
} from "../ui/OnboardingQuestionLayout";
import { AnimatedStepItem } from "../ui/AnimatedStepItem";
import { inputClass, labelClass } from "./form-primitives";

export type StepAccountProps = {
  data: VendorOnboardingData;
  update: VendorOnboardingUpdate;
  /** Wizard first-visit only - skip on live profile edit. */
  showWelcomeHero?: boolean;
};

export function StepAccount({ data, update, showWelcomeHero = false }: StepAccountProps) {
  const copy = STEP_COPY[1];

  return (
    <div className="space-y-7">
      {showWelcomeHero ? (
        <AnimatedStepItem index={0}>
          <LottieIllustration
            asset="welcome"
            className="mx-auto h-24 w-24 sm:h-28 sm:w-28"
            ariaLabel="Welcome"
            fallback={
              <span className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-primary-soft text-primary sm:h-28 sm:w-28">
                <PartyPopper className="h-10 w-10" strokeWidth={1.75} aria-hidden />
              </span>
            }
          />
        </AnimatedStepItem>
      ) : null}
      <OnboardingQuestionLayout
        lead={copy.lead}
        headline={copy.headline}
        subtext={copy.subtext}
        indexOffset={showWelcomeHero ? 1 : 0}
      />
      <OnboardingSubQuestion headline="Your name" indexOffset={showWelcomeHero ? 5 : 4}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass()}>First name</label>
            <input
              className={inputClass()}
              value={data.firstName}
              onChange={(e) => update({ firstName: e.target.value })}
              autoComplete="given-name"
            />
          </div>
          <div>
            <label className={labelClass()}>Last name</label>
            <input
              className={inputClass()}
              value={data.lastName}
              onChange={(e) => update({ lastName: e.target.value })}
              autoComplete="family-name"
            />
          </div>
        </div>
      </OnboardingSubQuestion>
      <OnboardingSubQuestion headline="Phone number" indexOffset={showWelcomeHero ? 8 : 7}>
        <input
          type="tel"
          className={inputClass()}
          value={data.phone}
          onChange={(e) => update({ phone: e.target.value })}
          autoComplete="tel"
        />
      </OnboardingSubQuestion>
    </div>
  );
}
