"use client";

import { LandingAudienceCta } from "@/features/landing/LandingAudienceCta";
import { LandingBrowseStrip } from "@/features/landing/LandingBrowseStrip";
import { LandingFaq } from "@/features/landing/LandingFaq";
import { LandingFeaturedVendors } from "@/features/landing/LandingFeaturedVendors";
import { LandingFooter } from "@/features/landing/LandingFooter";
import { LandingHero } from "@/features/landing/LandingHero";
import { LandingHowItWorks } from "@/features/landing/LandingHowItWorks";
import { LandingInspirationGrid } from "@/features/landing/LandingInspirationGrid";
import { LandingNav } from "@/features/landing/LandingNav";
import { LandingTrustStrip } from "@/features/landing/LandingTrustStrip";
import { ScrollToTopButton } from "@/components/ui/ScrollToTopButton";

export default function LandingMarketplace() {
  return (
    <div className="min-h-dvh bg-page-bg text-neutral-900">
      <LandingNav />
      <LandingHero />
      <LandingTrustStrip />
      <LandingBrowseStrip />
      <LandingFeaturedVendors />
      <LandingInspirationGrid />
      <LandingHowItWorks />
      <LandingAudienceCta />
      <LandingFaq />
      <LandingFooter />
      <ScrollToTopButton />
    </div>
  );
}
