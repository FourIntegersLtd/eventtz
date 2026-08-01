"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { WHY_EVENTTZ_PILLARS, WHY_EVENTTZ_SECTION } from "@/features/landing/landingData";
import { LandingSection } from "@/features/landing/LandingSection";
import {
  LANDING_SECTION_BG,
  LANDING_SECTION_BORDER,
} from "@/features/landing/landingSectionStyles";

export function LandingWhyEventtz() {
  return (
    <LandingSection
      id="why-eventtz"
      className={`${LANDING_SECTION_BORDER} ${LANDING_SECTION_BG.muted} relative py-14 sm:py-16 lg:py-20`}
    >
      <div className="mx-auto w-full max-w-4xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
          {WHY_EVENTTZ_SECTION.eyebrow}
        </p>
        <h2 className="font-heading mt-2 text-2xl font-semibold tracking-tight text-neutral-900 sm:mt-3 sm:text-3xl lg:text-4xl">
          {WHY_EVENTTZ_SECTION.title}
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-neutral-600 sm:mt-3 sm:text-base">
          {WHY_EVENTTZ_SECTION.description}
        </p>
        <span className="mx-auto mt-4 block h-px w-12 bg-primary/40" aria-hidden />
      </div>

      <div className="mx-auto mt-8 grid max-w-5xl gap-8 sm:mt-10 sm:grid-cols-3 sm:gap-y-8">
        {WHY_EVENTTZ_PILLARS.map(({ title, description, Icon }) => (
          <div key={title} className="text-center md:px-2">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent-gold/15 text-primary sm:h-16 sm:w-16">
              <Icon className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={1.6} aria-hidden />
            </span>
            <h3 className="font-heading mt-2.5 text-sm font-semibold text-neutral-900 sm:mt-3 sm:text-base">
              {title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600 sm:text-[15px] sm:leading-7">
              {description}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex justify-center sm:mt-10">
        <Link
          href="/client/browse"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary transition hover:gap-2.5 hover:opacity-90"
        >
          Browse vendors
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </LandingSection>
  );
}
