"use client";

import type { ReactNode } from "react";
import { AnimatedStepItem } from "./AnimatedStepItem";

type Props = {
  lead?: string;
  headline?: string;
  subtext?: string;
  supporting?: string;
  children?: ReactNode;
  /** Index offset when nesting inside a step that already used indices 0–n */
  indexOffset?: number;
};

export function OnboardingQuestionLayout({
  lead,
  headline,
  subtext,
  supporting,
  children,
  indexOffset = 0,
}: Props) {
  let idx = indexOffset;

  return (
    <div className="space-y-5">
      {lead ? (
        <AnimatedStepItem index={idx++}>
          <p className="text-base font-semibold text-primary">{lead}</p>
        </AnimatedStepItem>
      ) : null}
      {headline ? (
        <AnimatedStepItem index={idx++}>
          <h2 className="font-heading text-2xl font-semibold leading-snug text-neutral-900 sm:text-[1.625rem]">
            {headline}
          </h2>
        </AnimatedStepItem>
      ) : null}
      {subtext ? (
        <AnimatedStepItem index={idx++}>
          <p className="text-sm leading-relaxed text-neutral-600">{subtext}</p>
        </AnimatedStepItem>
      ) : null}
      {children ? (
        <AnimatedStepItem index={idx++}>{children}</AnimatedStepItem>
      ) : null}
      {supporting ? (
        <AnimatedStepItem index={idx++}>
          <p className="text-xs leading-relaxed text-neutral-500">{supporting}</p>
        </AnimatedStepItem>
      ) : null}
    </div>
  );
}

/** Sub-question within a step — animated headline + content block. */
export function OnboardingSubQuestion({
  headline,
  subtext,
  children,
  indexOffset,
}: {
  headline: string;
  subtext?: string;
  children: ReactNode;
  indexOffset: number;
}) {
  return (
    <div className="space-y-4">
      <AnimatedStepItem index={indexOffset}>
        <h3 className="font-heading text-lg font-semibold text-neutral-900">{headline}</h3>
      </AnimatedStepItem>
      {subtext ? (
        <AnimatedStepItem index={indexOffset + 1}>
          <p className="text-sm text-neutral-600">{subtext}</p>
        </AnimatedStepItem>
      ) : null}
      <AnimatedStepItem index={indexOffset + (subtext ? 2 : 1)}>{children}</AnimatedStepItem>
    </div>
  );
}
