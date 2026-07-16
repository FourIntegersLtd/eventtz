"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { FOCUS_RING, TOUCH_TARGET } from "@/components/ui/tokens";
import { AnimatedStepItem } from "@/components/vendor-onboarding/ui/AnimatedStepItem";
import { useClientOnboarding } from "@/features/client/onboarding/ClientOnboardingProvider";
import { OnboardingIconBadge } from "@/features/client/onboarding/OnboardingIconBadge";
import {
  CLIENT_ONBOARDING_COPY,
  CLIENT_ONBOARDING_STEPS,
  type ClientOnboardingStep,
} from "@/features/client/onboarding/clientOnboardingCopy";
import {
  CLIENT_ONBOARDING_FINISH_CHIPS,
  CLIENT_ONBOARDING_FINISH_ICON,
  CLIENT_ONBOARDING_ICON_VISUALS,
  CLIENT_ONBOARDING_NAME_ICON,
  CLIENT_ONBOARDING_WELCOME_ICON,
  type OnboardingIconVisual,
} from "@/features/client/onboarding/clientOnboardingVisuals";
import { useAuth } from "@/components/auth/AuthProvider";
import { parseForm, preferredNameFormSchema } from "@/lib/validation";

function stepIndex(step: ClientOnboardingStep): number {
  return CLIENT_ONBOARDING_STEPS.indexOf(step);
}

function FeatureHero({
  visual,
  eyebrow,
  headline,
  body,
  highlights,
}: {
  visual: OnboardingIconVisual;
  eyebrow: string;
  headline: string;
  body: string;
  highlights?: readonly string[];
}) {
  return (
    <div className="flex flex-col items-center px-2 py-4 text-center sm:px-4 sm:py-6">
      <AnimatedStepItem index={0}>
        <OnboardingIconBadge visual={visual} size="xl" />
      </AnimatedStepItem>
      <AnimatedStepItem index={1}>
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-accent-violet">{eyebrow}</p>
      </AnimatedStepItem>
      <AnimatedStepItem index={2}>
        <h2 className="font-heading mt-3 text-2xl font-semibold leading-tight text-neutral-900 sm:text-3xl">
          {headline}
        </h2>
      </AnimatedStepItem>
      <AnimatedStepItem index={3}>
        <p className="mt-4 max-w-lg text-base leading-relaxed text-neutral-600">{body}</p>
      </AnimatedStepItem>
      {highlights && highlights.length > 0 ? (
        <AnimatedStepItem index={4}>
          <ul className="mt-8 w-full max-w-md space-y-3 rounded-2xl bg-neutral-50 px-5 py-4 text-left ring-1 ring-neutral-200/60">
            {highlights.map((line) => (
              <li key={line} className="flex items-start gap-3 text-sm text-neutral-700">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </AnimatedStepItem>
      ) : null}
    </div>
  );
}

export function ClientWelcomeOnboardingModal() {
  const router = useRouter();
  const { user } = useAuth();
  const { shouldShow, saving, savePreferredName, complete, dismiss } = useClientOnboarding();
  const [step, setStep] = useState<ClientOnboardingStep>("welcome");
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);

  const copy = CLIENT_ONBOARDING_COPY;
  const currentIdx = stepIndex(step);
  const totalSteps = CLIENT_ONBOARDING_STEPS.length;
  const progressPct = ((currentIdx + 1) / totalSteps) * 100;

  useEffect(() => {
    if (!shouldShow) return;
    setStep("welcome");
    setName(user?.preferred_name?.trim() ?? "");
    setNameError(null);
  }, [shouldShow, user?.preferred_name]);

  const goNext = useCallback(() => {
    const idx = stepIndex(step);
    if (idx < CLIENT_ONBOARDING_STEPS.length - 1) {
      setStep(CLIENT_ONBOARDING_STEPS[idx + 1]!);
    }
  }, [step]);

  const goBack = useCallback(() => {
    const idx = stepIndex(step);
    if (idx > 0) {
      setStep(CLIENT_ONBOARDING_STEPS[idx - 1]!);
    }
  }, [step]);

  const finish = useCallback(
    (destination?: string) => {
      void complete();
      if (destination) router.push(destination);
    },
    [complete, router],
  );

  const close = useCallback(() => {
    dismiss();
  }, [dismiss]);

  useEffect(() => {
    if (!shouldShow) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [shouldShow, close]);

  if (!shouldShow) return null;

  const handleNameContinue = async () => {
    const parsed = parseForm(preferredNameFormSchema, { preferredName: name });
    if (!parsed.ok) {
      setNameError(parsed.formError);
      return;
    }
    setNameError(null);
    try {
      await savePreferredName(parsed.data.preferredName);
      goNext();
    } catch {
      setNameError("We couldn't save that just now. Try again or skip.");
    }
  };

  const isFeatureStep = step in CLIENT_ONBOARDING_ICON_VISUALS;
  const canSkip = step === "welcome" || step === "name";
  const showBack = currentIdx > 0 && step !== "finish";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Close onboarding"
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        onClick={close}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-onboarding-title"
        className="relative flex max-h-[min(92dvh,820px)] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
      >
        <div className="h-1.5 shrink-0 bg-neutral-100">
          <div
            className="h-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-neutral-100 px-5 py-3 sm:px-6">
          <p className="text-xs font-medium text-neutral-500">
            Step {currentIdx + 1} of {totalSteps}
          </p>
          <button
            type="button"
            onClick={close}
            className={`inline-flex shrink-0 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 ${TOUCH_TARGET} ${FOCUS_RING}`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          key={step}
          className="scroll-pane min-h-[min(52dvh,28rem)] flex-1 overflow-y-auto px-5 py-2 sm:min-h-[26rem] sm:px-8 sm:py-4"
        >
          {step === "welcome" ? (
            <div className="rounded-2xl bg-primary-soft px-6 py-10 text-center ring-1 ring-primary-border/50 sm:px-10 sm:py-12">
              <AnimatedStepItem index={0}>
                <div className="mx-auto inline-flex">
                  <OnboardingIconBadge visual={CLIENT_ONBOARDING_WELCOME_ICON} size="lg" />
                </div>
              </AnimatedStepItem>
              <AnimatedStepItem index={1}>
                <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-accent-violet">
                  {copy.welcome.eyebrow}
                </p>
              </AnimatedStepItem>
              <AnimatedStepItem index={2}>
                <h2
                  id="client-onboarding-title"
                  className="font-heading mt-3 text-3xl font-semibold leading-tight text-primary sm:text-4xl"
                >
                  {copy.welcome.headline}
                </h2>
              </AnimatedStepItem>
              <AnimatedStepItem index={3}>
                <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-neutral-600">
                  {copy.welcome.body}
                </p>
              </AnimatedStepItem>
            </div>
          ) : null}

          {step === "name" ? (
            <div className="flex flex-col items-center px-2 py-6 text-center sm:py-8">
              <AnimatedStepItem index={0}>
                <OnboardingIconBadge visual={CLIENT_ONBOARDING_NAME_ICON} size="lg" />
              </AnimatedStepItem>
              <AnimatedStepItem index={1}>
                <p className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-accent-violet">
                  {copy.name.eyebrow}
                </p>
              </AnimatedStepItem>
              <AnimatedStepItem index={2}>
                <h2 className="font-heading mt-3 text-2xl font-semibold text-neutral-900 sm:text-3xl">
                  {copy.name.headline}
                </h2>
              </AnimatedStepItem>
              <AnimatedStepItem index={3}>
                <p className="mt-3 max-w-md text-base leading-relaxed text-neutral-600">{copy.name.body}</p>
              </AnimatedStepItem>
              <AnimatedStepItem index={4}>
                <div className="mt-8 w-full max-w-sm text-left">
                  <TextField
                    label={copy.name.label}
                    placeholder={copy.name.placeholder}
                    value={name}
                    autoFocus
                    maxLength={80}
                    error={nameError ?? undefined}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (nameError) setNameError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleNameContinue();
                    }}
                  />
                </div>
              </AnimatedStepItem>
            </div>
          ) : null}

          {isFeatureStep ? (
            <FeatureHero
              visual={CLIENT_ONBOARDING_ICON_VISUALS[step as keyof typeof CLIENT_ONBOARDING_ICON_VISUALS]}
              eyebrow={copy[step as keyof typeof CLIENT_ONBOARDING_ICON_VISUALS].eyebrow}
              headline={copy[step as keyof typeof CLIENT_ONBOARDING_ICON_VISUALS].headline}
              body={copy[step as keyof typeof CLIENT_ONBOARDING_ICON_VISUALS].body}
              highlights={copy[step as keyof typeof CLIENT_ONBOARDING_ICON_VISUALS].highlights}
            />
          ) : null}

          {step === "finish" ? (
            <div className="flex flex-col items-center px-2 py-6 text-center sm:py-10">
              <AnimatedStepItem index={0}>
                <OnboardingIconBadge visual={CLIENT_ONBOARDING_FINISH_ICON} size="xl" />
              </AnimatedStepItem>
              <AnimatedStepItem index={1}>
                <p className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-accent-violet">
                  {copy.finish.eyebrow}
                </p>
              </AnimatedStepItem>
              <AnimatedStepItem index={2}>
                <h2 className="font-heading mt-3 text-2xl font-semibold text-neutral-900 sm:text-3xl">
                  {copy.finish.headline}
                </h2>
              </AnimatedStepItem>
              <AnimatedStepItem index={3}>
                <p className="mt-4 max-w-lg text-base leading-relaxed text-neutral-600">{copy.finish.body}</p>
              </AnimatedStepItem>
              <AnimatedStepItem index={4}>
                <div className="mt-8 grid w-full max-w-md gap-3 sm:grid-cols-2">
                  {CLIENT_ONBOARDING_FINISH_CHIPS.map(({ visual, label }) => (
                    <div
                      key={label}
                      className="flex items-center gap-3 rounded-xl bg-neutral-50 px-3 py-3 ring-1 ring-neutral-200/60"
                    >
                      <OnboardingIconBadge visual={visual} size="md" />
                      <span className="text-sm font-medium text-neutral-800">{label}</span>
                    </div>
                  ))}
                </div>
              </AnimatedStepItem>
            </div>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-neutral-100 px-5 py-4 sm:px-6">
          {step === "finish" ? (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button variant="secondary" className="w-full sm:w-auto" onClick={() => finish()}>
                {copy.finish.secondaryCta}
              </Button>
              <Button className="w-full sm:w-auto" onClick={() => finish("/client/browse")}>
                {copy.finish.primaryCta}
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                {showBack ? (
                  <Button variant="ghost" className="shrink-0" onClick={goBack}>
                    {copy.back}
                  </Button>
                ) : canSkip ? (
                  <Button variant="ghost" className="shrink-0" onClick={close}>
                    {copy.skip}
                  </Button>
                ) : (
                  <span className="w-16" aria-hidden />
                )}
              </div>
              <Button
                className="min-w-[7.5rem] shrink-0"
                loading={step === "name" && saving}
                onClick={() => {
                  if (step === "welcome") goNext();
                  else if (step === "name") void handleNameContinue();
                  else goNext();
                }}
              >
                {step === "welcome" ? copy.welcome.cta : step === "name" ? copy.name.cta : copy.continue}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
