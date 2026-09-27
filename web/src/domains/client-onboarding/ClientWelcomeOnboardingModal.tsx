"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button, TextField } from "@/foundation/ui";
import { useSession } from "@/foundation/session";
import { useClientOnboarding } from "@/domains/client-onboarding/ClientOnboardingProvider";
import {
  CLIENT_ONBOARDING_COPY,
  CLIENT_ONBOARDING_STEPS,
  type ClientOnboardingFeatureStep,
  type ClientOnboardingStep,
} from "@/domains/client-onboarding/clientOnboardingCopy";
import {
  nextStep,
  parsePreferredName,
  previousStep,
  stepIndex,
} from "@/domains/client-onboarding/clientOnboardingLogic";

/** The labels shown as "what you can do now" chips on the finish slide (baseline's `CLIENT_ONBOARDING_FINISH_CHIPS`, icons dropped). */
const CLIENT_ONBOARDING_FINISH_LABELS = ["Browse vendors", "Book & pay", "Message", "Disputes"] as const;

/** The copy for a feature slide, or null for welcome/name/finish. */
function featureCopy(step: ClientOnboardingStep): ClientOnboardingFeatureStep | null {
  switch (step) {
    case "browse":
      return CLIENT_ONBOARDING_COPY.browse;
    case "book":
      return CLIENT_ONBOARDING_COPY.book;
    case "payments":
      return CLIENT_ONBOARDING_COPY.payments;
    case "messages":
      return CLIENT_ONBOARDING_COPY.messages;
    case "disputes":
      return CLIENT_ONBOARDING_COPY.disputes;
    default:
      return null;
  }
}

/** The shared layout for the five feature slides. */
function FeatureHero({ copy }: { copy: ClientOnboardingFeatureStep }) {
  return (
    <div className="flex flex-col items-center px-2 py-4 text-center sm:px-4 sm:py-6">
      <p className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-accent-violet">{copy.eyebrow}</p>
      <h2 className="font-heading mt-3 text-2xl font-semibold leading-tight text-neutral-900 sm:text-3xl">
        {copy.headline}
      </h2>
      <p className="mt-4 max-w-lg text-base leading-relaxed text-neutral-600">{copy.body}</p>
      {copy.highlights && copy.highlights.length > 0 ? (
        <ul className="mt-8 w-full max-w-md space-y-3 rounded-2xl bg-neutral-50 px-5 py-4 text-left ring-1 ring-neutral-200/60">
          {copy.highlights.map((line) => (
            <li key={line} className="text-sm text-neutral-700">
              {line}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

type OnboardingTourProps = {
  preferredName: string;
  saving: boolean;
  onSavePreferredName: (preferredName: string) => Promise<void>;
  onComplete: () => Promise<void>;
  onDismiss: () => void;
};

/**
 * The step-by-step content. Mounted only while the tour is open, so its
 * `useState` initialisers reset it to the start (prefilling the name) on each
 * fresh open without a state-resetting effect.
 */
function OnboardingTour({ preferredName, saving, onSavePreferredName, onComplete, onDismiss }: OnboardingTourProps) {
  const router = useRouter();
  const [step, setStep] = useState<ClientOnboardingStep>("welcome");
  const [name, setName] = useState(preferredName);
  const [nameError, setNameError] = useState<string | null>(null);

  const copy = CLIENT_ONBOARDING_COPY;
  const currentIdx = stepIndex(step);
  const totalSteps = CLIENT_ONBOARDING_STEPS.length;
  const progressPct = ((currentIdx + 1) / totalSteps) * 100;

  const close = useCallback(() => {
    onDismiss();
  }, [onDismiss]);

  const finish = useCallback(
    (destination?: string) => {
      void onComplete();
      if (destination) router.push(destination);
    },
    [onComplete, router],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close]);

  async function handleNameContinue() {
    const parsed = parsePreferredName(name);
    if (!parsed.ok) {
      setNameError(parsed.error);
      return;
    }
    setNameError(null);
    try {
      await onSavePreferredName(parsed.value);
      setStep(nextStep(step));
    } catch {
      setNameError("We couldn't save that just now. Try again or skip.");
    }
  }

  const feature = featureCopy(step);
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
          <div className="h-full bg-primary transition-all duration-300 ease-out" style={{ width: `${progressPct}%` }} />
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-neutral-100 px-5 py-3 sm:px-6">
          <p className="text-xs font-medium text-neutral-500">
            Step {currentIdx + 1} of {totalSteps}
          </p>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="inline-flex shrink-0 items-center justify-center rounded-lg px-3 py-2 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-700"
          >
            Close
          </button>
        </div>

        <div className="min-h-[min(52dvh,28rem)] flex-1 overflow-y-auto px-5 py-2 sm:min-h-[26rem] sm:px-8 sm:py-4">
          {step === "welcome" ? (
            <div className="rounded-2xl bg-primary-soft px-6 py-10 text-center ring-1 ring-primary-border/50 sm:px-10 sm:py-12">
              <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-accent-violet">{copy.welcome.eyebrow}</p>
              <h2 id="client-onboarding-title" className="font-heading mt-3 text-3xl font-semibold leading-tight text-primary sm:text-4xl">
                {copy.welcome.headline}
              </h2>
              <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-neutral-600">{copy.welcome.body}</p>
            </div>
          ) : null}

          {step === "name" ? (
            <div className="flex flex-col items-center px-2 py-6 text-center sm:py-8">
              <p className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-accent-violet">{copy.name.eyebrow}</p>
              <h2 className="font-heading mt-3 text-2xl font-semibold text-neutral-900 sm:text-3xl">{copy.name.headline}</h2>
              <p className="mt-3 max-w-md text-base leading-relaxed text-neutral-600">{copy.name.body}</p>
              <div className="mt-8 w-full max-w-sm text-left">
                <TextField
                  label={copy.name.label}
                  placeholder={copy.name.placeholder}
                  value={name}
                  autoFocus
                  maxLength={80}
                  error={nameError ?? undefined}
                  onChange={(event) => {
                    setName(event.target.value);
                    if (nameError) setNameError(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void handleNameContinue();
                  }}
                />
              </div>
            </div>
          ) : null}

          {feature ? <FeatureHero copy={feature} /> : null}

          {step === "finish" ? (
            <div className="flex flex-col items-center px-2 py-6 text-center sm:py-10">
              <p className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-accent-violet">{copy.finish.eyebrow}</p>
              <h2 className="font-heading mt-3 text-2xl font-semibold text-neutral-900 sm:text-3xl">{copy.finish.headline}</h2>
              <p className="mt-4 max-w-lg text-base leading-relaxed text-neutral-600">{copy.finish.body}</p>
              <div className="mt-8 grid w-full max-w-md gap-3 sm:grid-cols-2">
                {CLIENT_ONBOARDING_FINISH_LABELS.map((label) => (
                  <div key={label} className="flex items-center gap-3 rounded-xl bg-neutral-50 px-3 py-3 ring-1 ring-neutral-200/60">
                    <span className="text-sm font-medium text-neutral-800">{label}</span>
                  </div>
                ))}
              </div>
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
                  <Button variant="secondary" className="shrink-0" onClick={() => setStep(previousStep(step))}>
                    {copy.back}
                  </Button>
                ) : canSkip ? (
                  <Button variant="secondary" className="shrink-0" onClick={close}>
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
                  if (step === "welcome") setStep(nextStep(step));
                  else if (step === "name") void handleNameContinue();
                  else setStep(nextStep(step));
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

/**
 * The first-visit tour: a full-screen dialog walking a new client through the
 * portal. Ported from the baseline's `ClientWelcomeOnboardingModal`, with the
 * `LottieIllustration`s, `lucide-react` icons and `AnimatedStepItem` transitions
 * dropped (`web/` has none of them) — the step copy is word-for-word identical.
 */
export function ClientWelcomeOnboardingModal() {
  const { session } = useSession();
  const { shouldShow, saving, savePreferredName, complete, dismiss } = useClientOnboarding();

  if (!shouldShow) return null;

  return (
    <OnboardingTour
      preferredName={session?.user.preferred_name?.trim() ?? ""}
      saving={saving}
      onSavePreferredName={savePreferredName}
      onComplete={complete}
      onDismiss={dismiss}
    />
  );
}
