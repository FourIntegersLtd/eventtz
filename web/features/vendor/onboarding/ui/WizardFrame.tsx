"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { STEP_LABELS } from "../../../../lib/vendorOnboarding/constants";
import { WIZARD_HEAD } from "../onboardingCopy";
import { ONBOARDING_FORM_STEP_COUNT } from "../../../../lib/vendorOnboarding/onboardingProgress";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

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
    <Card className="px-6 pb-3 pt-5">
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
    </Card>
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
        <PageHeader descriptionSize="body" eyebrow="Vendor profile" title={head.pageTitle} description="Your answers save as you go. You can leave and come back." />
        <WizardStepper step={step} />
      </div>
      {/* The design places the split beside the stepper's stack, so no stack gap sits between them. */}
      <div className="ez-split">
        <div className="ez-split__main ez-stack ez-stack--lg">
          <Card>
            <Card.Header>
              <div className="ez-stack ez-stack--sm">
                <span className="ez-eyebrow">
                  Step {step} of {ONBOARDING_FORM_STEP_COUNT}
                </span>
                <h2 className="ez-h2">{head.cardTitle}</h2>
                <p className="ez-small">{head.cardSubtext}</p>
              </div>
              {draftSavedLabel ? (
                <Badge tone="success">
                  Draft saved {draftSavedLabel}
                </Badge>
              ) : null}
            </Card.Header>
            <Card.Body className="vendor-setup">{children}</Card.Body>
            <Card.Footer>
              {footer.note ? (
                <p className="ez-small mr-auto">
                  {footer.note}
                </p>
              ) : null}
              {footer.showBackToReview ? (
                <Button
                  variant="secondary"
                  type="button"
                  onClick={footer.onBackToReview}>
                  Back to review
                </Button>
              ) : null}
              {footer.showBack ? (
                <Button
                  variant="ghost"
                  type="button"
                  onClick={footer.onBack}>
                  {footer.backLabel}
                </Button>
              ) : null}
              {footer.hidePrimary ? null : (
                <Button
                  type="button"
                  onClick={footer.onPrimary}
                  disabled={footer.saving}>
                  {footer.saving ? "Saving…" : footer.primaryLabel}
                </Button>
              )}
            </Card.Footer>
          </Card>
        </div>
        <div className="ez-split__aside ez-stack ez-stack--lg">{aside}</div>
      </div>
    </>
  );
}
