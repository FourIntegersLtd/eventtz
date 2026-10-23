"use client";

import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { STEP_LABELS } from "../../../../lib/vendorOnboarding/constants";
import { WIZARD_HEAD } from "../onboardingCopy";
import { ONBOARDING_FORM_STEP_COUNT } from "../../../../lib/vendorOnboarding/onboardingProgress";

/** Footer controls of the wizard card; the parent owns every handler and flag. */
export type WizardFooterProps = {
  showBack: boolean;
  backLabel: string;
  onBack: () => void;
  /** Jumped from review to fix one section: offer a way straight back. */
  showBackToReview: boolean;
  onBackToReview: () => void;
  hidePrimary: boolean;
  saving: boolean;
  primaryLabel: string;
  onPrimary: () => void;
  /** Explanatory note on the left of the footer (locked-review states). */
  note?: string | null;
};

type WizardFrameProps = {
  step: number;
  /** "just now", "5 min ago"...; null hides the badge until a draft row exists. */
  draftSavedLabel: string | null;
  footer: WizardFooterProps;
  aside: ReactNode;
  children: ReactNode;
};

/** The 9-step stepper: finished steps show a tick, the current one is highlighted. */
function WizardStepper({ step }: { step: number }) {
  return (
    <div className="ez-card" style={{ padding: "20px 24px 12px" }}>
      <div className="ez-stepper" role="list" aria-label="Onboarding steps">
        {STEP_LABELS.slice(0, ONBOARDING_FORM_STEP_COUNT).map(
          (label, index) => {
            const stepNumber = index + 1;
            const state =
              stepNumber < step
                ? " ez-step--done"
                : stepNumber === step
                  ? " ez-step--current"
                  : "";
            return (
              <div
                key={label}
                className={`ez-step${state}`}
                aria-current={stepNumber === step ? "step" : undefined}
              >
                <span className="ez-step__dot">
                  {stepNumber < step ? (
                    <Check size={16} strokeWidth={1.75} aria-hidden />
                  ) : (
                    stepNumber
                  )}
                </span>
                <span>{label}</span>
              </div>
            );
          },
        )}
      </div>
    </div>
  );
}

/**
 * Wizard layout for steps 1-9: page heading, stepper, then the form card (with its
 * Back and Save and continue footer) beside the step's aside.
 */
export function WizardFrame({
  step,
  draftSavedLabel,
  footer,
  aside,
  children,
}: WizardFrameProps) {
  const head = WIZARD_HEAD[step];
  return (
    <>
      <div className="ez-stack ez-stack--lg">
        <div className="ez-pagehead">
          <div className="ez-pagehead__text">
            <span className="ez-eyebrow">Vendor profile</span>
            <h1 className="ez-h1">{head.pageTitle}</h1>
            <p className="ez-body">
              Your answers save as you go. You can leave and come back.
            </p>
          </div>
        </div>
        <WizardStepper step={step} />
      </div>
      {/* The design places the split beside the stepper's stack, so no stack gap sits between them. */}
      <div className="ez-split">
        <div className="ez-split__main ez-stack ez-stack--lg">
          <div className="ez-card">
            <div className="ez-card__head">
              <div className="ez-stack ez-stack--sm">
                <span className="ez-eyebrow">
                  Step {step} of {ONBOARDING_FORM_STEP_COUNT}
                </span>
                <h2 className="ez-h2">{head.cardTitle}</h2>
                <p className="ez-small">{head.cardSubtext}</p>
              </div>
              {draftSavedLabel ? (
                <span className="ez-badge ez-badge--success">
                  Draft saved {draftSavedLabel}
                </span>
              ) : null}
            </div>
            <div className="ez-card__body vendor-setup">{children}</div>
            <div className="ez-card__foot">
              {footer.note ? (
                <p className="ez-small" style={{ marginRight: "auto" }}>
                  {footer.note}
                </p>
              ) : null}
              {footer.showBackToReview ? (
                <button
                  className="ez-btn ez-btn--secondary"
                  type="button"
                  onClick={footer.onBackToReview}
                >
                  Back to review
                </button>
              ) : null}
              {footer.showBack ? (
                <button
                  className="ez-btn ez-btn--ghost"
                  type="button"
                  onClick={footer.onBack}
                >
                  {footer.backLabel}
                </button>
              ) : null}
              {footer.hidePrimary ? null : (
                <button
                  className="ez-btn ez-btn--primary"
                  type="button"
                  onClick={footer.onPrimary}
                  disabled={footer.saving}
                >
                  {footer.saving ? "Saving…" : footer.primaryLabel}
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="ez-split__aside ez-stack ez-stack--lg">{aside}</div>
      </div>
    </>
  );
}
