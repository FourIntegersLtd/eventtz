"use client";

import { useState } from "react";
import { PartyPopper } from "lucide-react";
import { LottieIllustration } from "@/components/ui/LottieIllustration";
import type { VendorOnboardingData, VendorOnboardingUpdate } from "../types";
import {
  OnboardingSubQuestion,
} from "../ui/OnboardingQuestionLayout";
import { AnimatedStepItem } from "../ui/AnimatedStepItem";
import { ClearableTextField, labelClass } from "./form-primitives";
import { isValidPhoneNumber } from "@/lib/validation/phone";

export type StepAccountProps = {
  data: VendorOnboardingData;
  update: VendorOnboardingUpdate;
  phoneError: string | null;
  setPhoneError: (v: string | null) => void;
  /** Wizard first-visit only - skip on live profile edit. */
  showWelcomeHero?: boolean;
};

export function StepAccount({
  data,
  update,
  phoneError,
  setPhoneError,
  showWelcomeHero = false,
}: StepAccountProps) {
  const [phoneVerified, setPhoneVerified] = useState<boolean | null>(null);

  const verifyPhone = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      setPhoneError(null);
      setPhoneVerified(null);
      return;
    }
    if (isValidPhoneNumber(trimmed)) {
      setPhoneError(null);
      setPhoneVerified(true);
    } else {
      setPhoneError("Enter a valid phone number (e.g. 07xxx xxxxxx or +44 7xxx xxxxxx).");
      setPhoneVerified(false);
    }
  };

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
      <OnboardingSubQuestion headline="Your name" indexOffset={showWelcomeHero ? 1 : 0}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass()}>First name</label>
            <ClearableTextField
              value={data.firstName}
              onChange={(v) => update({ firstName: v })}
              autoComplete="given-name"
            />
          </div>
          <div>
            <label className={labelClass()}>Last name</label>
            <ClearableTextField
              value={data.lastName}
              onChange={(v) => update({ lastName: v })}
              autoComplete="family-name"
            />
          </div>
        </div>
      </OnboardingSubQuestion>
      <OnboardingSubQuestion headline="Phone number" indexOffset={showWelcomeHero ? 2 : 1}>
        <div>
          <label className={labelClass()}>Phone number</label>
          <ClearableTextField
            type="tel"
            value={data.phone}
            onChange={(v) => {
              update({ phone: v });
              setPhoneError(null);
              setPhoneVerified(null);
            }}
            onBlur={() => verifyPhone(data.phone)}
            autoComplete="tel"
            placeholder="07xxx xxxxxx"
          />
          {phoneError ? (
            <p className="mt-1 text-sm text-red-600">{phoneError}</p>
          ) : phoneVerified ? (
            <p className="mt-1 text-sm text-green-600">Phone number looks good.</p>
          ) : (
            <p className="mt-1 text-xs text-neutral-400">
              UK mobile or landline. Include +44 for international numbers.
            </p>
          )}
        </div>
      </OnboardingSubQuestion>
    </div>
  );
}
