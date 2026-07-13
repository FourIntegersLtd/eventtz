"use client";

import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { LANDING_SCREENSHOT_FRAME_CLASS } from "@/features/landing/LandingFeatureSplit";
import { VENDOR_SECTION } from "@/features/landing/landingData";
import { LandingSection } from "@/features/landing/LandingSection";
import {
  LANDING_FEATURE_HEADLINE_CLASS,
  landingFeatureSectionClass,
} from "@/features/landing/landingSectionStyles";
import { VendorDashboardMock } from "@/features/landing/VendorDashboardMock";

export function LandingVendorSection() {
  return (
    <LandingSection
      id="for-vendors"
      className={landingFeatureSectionClass("muted")}
      width="7xl"
    >
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-12 xl:gap-16">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            {VENDOR_SECTION.eyebrow}
          </p>
          <h2 className={`${LANDING_FEATURE_HEADLINE_CLASS} mt-2.5`}>{VENDOR_SECTION.title}</h2>

          <ButtonLink
            href={VENDOR_SECTION.ctaHref}
            shape="pill"
            className="mt-8 px-6 py-3"
          >
            {VENDOR_SECTION.ctaLabel}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </ButtonLink>
        </div>

        <div className={`hidden min-w-0 lg:block ${LANDING_SCREENSHOT_FRAME_CLASS}`}>
          <VendorDashboardMock />
        </div>
      </div>
    </LandingSection>
  );
}
