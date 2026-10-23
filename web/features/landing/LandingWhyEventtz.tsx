"use client";

import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { WHY_EVENTTZ_PILLARS, WHY_EVENTTZ_SECTION } from "@/features/landing/landingData";
import { LandingSection } from "@/components/landing/LandingSection";
import {
  LANDING_SECTION_BG,
  LANDING_SECTION_BORDER,
} from "@/components/landing/landingSectionStyles";

export function LandingWhyEventtz() {
  return (
    <LandingSection
      id="why-eventtz"
      className={`${LANDING_SECTION_BORDER} ${LANDING_SECTION_BG.white} relative py-14 sm:py-16 lg:py-20`}
    >
      <div className="mx-auto w-full max-w-4xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ink-3">
          {WHY_EVENTTZ_SECTION.eyebrow}
        </p>
        <h2 className="font-heading mt-2 text-2xl font-semibold tracking-tight text-ink sm:mt-3 sm:text-3xl lg:text-4xl">
          {WHY_EVENTTZ_SECTION.title}
        </h2>
        <span className="mx-auto mt-4 block h-px w-12 bg-accent-gold" aria-hidden />
      </div>

      <div className="mx-auto mt-8 grid max-w-5xl gap-8 sm:mt-10 sm:grid-cols-3 sm:gap-y-8">
        {WHY_EVENTTZ_PILLARS.map(({ title, description, Icon, iconBg, iconColor }) => (
          <Card key={title} variant="muted" className="p-6 text-center">
            <span
              className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full sm:h-16 sm:w-16 ${iconBg}`}
            >
              <Icon className={`h-6 w-6 sm:h-7 sm:w-7 ${iconColor}`} strokeWidth={1.6} aria-hidden />
            </span>
            <h3 className="font-heading mt-2.5 text-sm font-semibold text-ink sm:mt-3 sm:text-base">
              {title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-2 sm:text-[15px] sm:leading-7">
              {description}
            </p>
          </Card>
        ))}
      </div>

      <div className="mt-8 flex justify-center sm:mt-10">
        <ButtonLink
          href="/client/browse"
          variant="secondary"
        >
          Browse vendors
          <ArrowRight className="h-4 w-4" aria-hidden />
        </ButtonLink>
      </div>
    </LandingSection>
  );
}
