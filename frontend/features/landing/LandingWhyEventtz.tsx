"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { WHY_EVENTTZ_PILLARS, WHY_EVENTTZ_SECTION } from "@/features/landing/landingData";
import { LandingSection } from "@/features/landing/LandingSection";
import { landingSectionClass, LANDING_SECTION_CONTENT_MT, LANDING_SECTION_STACK_MT } from "@/features/landing/landingSectionStyles";

export function LandingWhyEventtz() {
  return (
    <LandingSection
      id="why-eventtz"
      className={landingSectionClass("muted", { shell: "near" })}
    >
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          {WHY_EVENTTZ_SECTION.eyebrow}
        </p>
        <h2 className="font-heading mt-2.5 text-2xl font-semibold tracking-tight text-primary sm:text-3xl md:text-4xl">
          {WHY_EVENTTZ_SECTION.title}
        </h2>
        <p className="mt-3 hidden text-sm leading-relaxed text-neutral-600 sm:text-base md:block">
          {WHY_EVENTTZ_SECTION.description}
        </p>
      </div>

      <div className={`grid gap-8 sm:grid-cols-2 lg:grid-cols-4 ${LANDING_SECTION_CONTENT_MT}`}>
        {WHY_EVENTTZ_PILLARS.map(({ title, description, Icon }) => (
          <div key={title} className="text-center md:px-2">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent-gold/15 text-primary">
              <Icon className="h-6 w-6" strokeWidth={1.6} aria-hidden />
            </span>
            <h3 className="font-heading mt-5 text-lg font-semibold text-primary">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600 sm:text-[15px] sm:leading-7">
              {description}
            </p>
          </div>
        ))}
      </div>

      <div className={`flex justify-center ${LANDING_SECTION_STACK_MT}`}>
        <Link
          href="/client/browse"
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary transition hover:opacity-80"
        >
          Browse vendors
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </LandingSection>
  );
}
