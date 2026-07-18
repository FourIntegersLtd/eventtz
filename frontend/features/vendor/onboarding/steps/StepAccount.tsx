import type { VendorOnboardingData, VendorOnboardingUpdate } from "../types";
import { STEP_COPY } from "../onboardingCopy";
import {
  OnboardingQuestionLayout,
  OnboardingSubQuestion,
} from "../ui/OnboardingQuestionLayout";
import { inputClass, labelClass } from "./form-primitives";

export type StepAccountProps = {
  data: VendorOnboardingData;
  update: VendorOnboardingUpdate;
};

export function StepAccount({ data, update }: StepAccountProps) {
  const copy = STEP_COPY[1];

  return (
    <div className="space-y-7">
      <OnboardingQuestionLayout
        lead={copy.lead}
        headline={copy.headline}
        subtext={copy.subtext}
      />
      <OnboardingSubQuestion headline="Your name" indexOffset={4}>
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
      <OnboardingSubQuestion headline="Phone number" indexOffset={7}>
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
