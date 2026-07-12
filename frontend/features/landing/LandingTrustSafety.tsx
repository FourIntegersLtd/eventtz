"use client";

import { TRUST_SAFETY_ITEMS, TRUST_SAFETY_SECTION } from "@/features/landing/landingData";
import { LandingSectionHeading } from "@/features/landing/LandingSectionHeading";
import { LandingSection } from "@/features/landing/LandingSection";
import {
  LANDING_SECTION_CONTENT_MT,
  landingSectionClass,
} from "@/features/landing/landingSectionStyles";

export function LandingTrustSafety() {
  return (
    <LandingSection
      id="trust"
      className={landingSectionClass("white")}
      width="4xl"
    >
      <LandingSectionHeading
        eyebrow={TRUST_SAFETY_SECTION.eyebrow}
        title={TRUST_SAFETY_SECTION.title}
        description={TRUST_SAFETY_SECTION.description}
      />

      <dl className={`divide-y divide-primary-border/60 ${LANDING_SECTION_CONTENT_MT}`}>
        {TRUST_SAFETY_ITEMS.map(({ title, description, Icon }) => (
          <div key={title} className="flex gap-4 py-6 first:pt-0 last:pb-0 sm:gap-5 sm:py-7">
            <Icon
              className="mt-0.5 h-5 w-5 shrink-0 text-primary sm:h-[1.35rem] sm:w-[1.35rem]"
              strokeWidth={1.75}
              aria-hidden
            />
            <div className="min-w-0">
              <dt className="font-heading text-base font-semibold text-primary sm:text-lg">{title}</dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-neutral-600 sm:text-[15px] sm:leading-7">
                {description}
              </dd>
            </div>
          </div>
        ))}
      </dl>
    </LandingSection>
  );
}
