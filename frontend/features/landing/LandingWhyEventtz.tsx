"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { WHY_EVENTTZ_PILLARS, WHY_EVENTTZ_SECTION } from "@/features/landing/landingData";
import { LandingSection } from "@/features/landing/LandingSection";

export function LandingWhyEventtz() {
  return (
    <LandingSection
      id="why-eventtz"
      className="border-y border-primary-border/50 bg-white py-16 sm:py-20 md:py-24"
      width="6xl"
    >
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          {WHY_EVENTTZ_SECTION.eyebrow}
        </p>
        <h2 className="font-heading mt-2.5 text-2xl font-semibold tracking-tight text-primary sm:text-3xl md:text-4xl">
          {WHY_EVENTTZ_SECTION.title}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600 sm:text-base">
          {WHY_EVENTTZ_SECTION.description}
        </p>
      </div>

      <div className="mx-auto mt-10 grid max-w-4xl gap-3 sm:grid-cols-3 sm:mt-12">
        {WHY_EVENTTZ_SECTION.pains.map((pain) => (
          <p
            key={pain}
            className="rounded-2xl border border-primary-border/60 bg-neutral-50 px-4 py-3.5 text-sm italic leading-relaxed text-neutral-600"
          >
            &ldquo;{pain}&rdquo;
          </p>
        ))}
      </div>

      <div className="mt-12 grid gap-10 sm:mt-14 md:grid-cols-3 md:gap-8">
        {WHY_EVENTTZ_PILLARS.map(({ title, description, Icon }) => (
          <div
            key={title}
            className="relative text-center md:px-4 md:after:absolute md:after:-right-4 md:after:top-8 md:after:h-[calc(100%-4rem)] md:after:w-px md:after:bg-primary-border/70 md:last:after:hidden"
          >
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

      <div className="mt-12 flex justify-center sm:mt-14">
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
