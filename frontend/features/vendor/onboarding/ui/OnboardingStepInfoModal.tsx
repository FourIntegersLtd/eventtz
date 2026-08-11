"use client";

import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { getOnboardingStepGuide, type OnboardingStepGuide } from "../onboardingStepGuides";

type Props = {
  step: number;
  servicesOffered?: string[];
  isOpen: boolean;
  onClose: () => void;
};

function GuideBody({ guide }: { guide: OnboardingStepGuide }) {
  return (
    <div className="space-y-4 text-sm leading-relaxed text-neutral-700">
      {guide.sections.map((section, i) => (
        <div key={i}>
          {section.heading ? (
            <p className="mb-1 font-semibold text-neutral-900">{section.heading}</p>
          ) : null}
          <p className="whitespace-pre-line">{section.body}</p>
        </div>
      ))}
    </div>
  );
}

export function OnboardingStepInfoTrigger({
  step,
  servicesOffered = [],
  onOpen,
}: {
  step: number;
  servicesOffered?: string[];
  onOpen: () => void;
}) {
  if (!getOnboardingStepGuide(step, servicesOffered)) return null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
    >
      <CircleHelp className="h-4 w-4" aria-hidden />
      What we need here
    </button>
  );
}

export function OnboardingStepInfoModal({
  step,
  servicesOffered = [],
  isOpen,
  onClose,
}: Props) {
  const guide = getOnboardingStepGuide(step, servicesOffered);
  if (!guide) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={guide.title}
      maxWidthClassName="max-w-lg"
      footer={
        <div className="flex justify-end">
          <Button type="button" onClick={onClose}>
            Got it
          </Button>
        </div>
      }
    >
      <GuideBody guide={guide} />
    </Modal>
  );
}
