"use client";

import { PRICING_TRUST_SECTION } from "@/features/landing/landingData";
import { LandingFeatureSplit } from "@/features/landing/LandingFeatureSplit";

export function LandingPricingTrust() {
  return (
    <LandingFeatureSplit
      id="pricing-trust"
      variant="stacked"
      eyebrow={PRICING_TRUST_SECTION.eyebrow}
      title={PRICING_TRUST_SECTION.title}
      description={PRICING_TRUST_SECTION.description}
      imageSrc={PRICING_TRUST_SECTION.screenshotSrc}
      imageAlt="Vendor profile with package pricing and discounts on Eventtz"
      ctaHref={PRICING_TRUST_SECTION.ctaHref}
      ctaLabel={PRICING_TRUST_SECTION.ctaLabel}
      tone="white"
    />
  );
}
