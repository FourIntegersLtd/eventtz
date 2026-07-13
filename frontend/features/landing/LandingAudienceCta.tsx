"use client";

import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { LandingSection } from "@/features/landing/LandingSection";
import { landingSectionClass } from "@/features/landing/landingSectionStyles";

const CLIENT_CTA = {
  eyebrow: "Clients",
  title: "Stop searching in the group chat.",
  description:
    "Find vetted vendors, agree the details in one place, and book without another group chat.",
  href: "/client/browse",
  label: "Browse vendors",
} as const;

export function LandingAudienceCta() {
  return (
    <LandingSection className={landingSectionClass("muted")} width="6xl">
      <div className="mx-auto max-w-xl rounded-3xl border border-primary-border/60 bg-primary-soft/25 p-5 shadow-sm sm:max-w-2xl sm:p-8 md:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{CLIENT_CTA.eyebrow}</p>
        <h2 className="font-heading mt-2 text-lg font-semibold leading-snug tracking-tight text-primary sm:mt-3 sm:text-2xl md:text-3xl">
          {CLIENT_CTA.title}
        </h2>
        <p className="mt-2 hidden text-sm leading-relaxed text-neutral-600 sm:block">{CLIENT_CTA.description}</p>
        <ButtonLink
          href={CLIENT_CTA.href}
          shape="pill"
          className="mt-4 px-5 py-2.5 text-sm sm:mt-8 sm:px-6 sm:py-3 sm:text-base"
        >
          {CLIENT_CTA.label}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </ButtonLink>
      </div>
    </LandingSection>
  );
}
