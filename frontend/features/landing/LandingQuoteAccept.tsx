"use client";

import { QUOTE_SECTION } from "@/features/landing/landingData";
import { LandingFeatureSplit } from "@/features/landing/LandingFeatureSplit";

export function LandingQuoteAccept() {
  return (
    <LandingFeatureSplit
      id="quote-accept"
      title={QUOTE_SECTION.title}
      description={QUOTE_SECTION.description}
      imageSrc={QUOTE_SECTION.screenshotSrc}
      imageAlt="Vendor booking with accept and reject on Eventtz"
      ctaHref={QUOTE_SECTION.ctaHref}
      ctaLabel={QUOTE_SECTION.ctaLabel}
      imagePosition="right"
      imageLayout="desktop-large"
      tone="white"
    />
  );
}
