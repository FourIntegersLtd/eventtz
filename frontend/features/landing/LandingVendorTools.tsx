"use client";

import { VENDOR_TOOLS_SECTION } from "@/features/landing/landingData";
import { LandingFeatureSplit } from "@/features/landing/LandingFeatureSplit";
import { VendorDiscountsMock } from "@/features/landing/VendorDiscountsMock";

export function LandingVendorTools() {
  return (
    <LandingFeatureSplit
      id="vendor-tools"
      title={VENDOR_TOOLS_SECTION.title}
      description={VENDOR_TOOLS_SECTION.description}
      imageAlt="Vendor onboarding with packages and discounts on Eventtz"
      imageFallback={<VendorDiscountsMock />}
      ctaHref={VENDOR_TOOLS_SECTION.ctaHref}
      ctaLabel={VENDOR_TOOLS_SECTION.ctaLabel}
      imagePosition="right"
      imageLayout="desktop-large"
      tone="muted"
    />
  );
}
