"use client";

import { LandingBrowseStrip } from "@/features/landing/LandingBrowseStrip";
import { LandingClientJourneyScroll } from "@/features/landing/LandingClientJourneyScroll";
import { LandingFaq } from "@/features/landing/LandingFaq";
import { LandingFeaturedVendors } from "@/features/landing/LandingFeaturedVendors";
import { LandingFooter } from "@/features/landing/LandingFooter";
import { LandingHero } from "@/features/landing/LandingHero";
import { LandingInspirationGrid } from "@/features/landing/LandingInspirationGrid";
import { LandingNav } from "@/features/landing/LandingNav";
import { LandingReviewsSection } from "@/features/landing/LandingReviewsSection";
import { LandingTrustStrip } from "@/features/landing/LandingTrustStrip";
import { LandingVendorSection } from "@/features/landing/LandingVendorSection";
import { LandingWhyEventtz } from "@/features/landing/LandingWhyEventtz";
import { ScrollToTopButton } from "@/components/ui/ScrollToTopButton";

export default function LandingMarketplace() {
  return (
    <div className="min-h-dvh overflow-x-clip bg-page-bg text-neutral-900">
      <LandingNav />
      <LandingHero />
      <LandingTrustStrip />
      <LandingBrowseStrip />
      <LandingFeaturedVendors />
      <LandingReviewsSection />
      <LandingClientJourneyScroll />
      <LandingWhyEventtz />
      <LandingInspirationGrid />
      <LandingVendorSection />
      <LandingFaq />
      <LandingFooter />
      <ScrollToTopButton />
    </div>
  );
}
