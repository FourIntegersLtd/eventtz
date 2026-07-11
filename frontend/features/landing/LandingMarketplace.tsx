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
import { LandingReviewsSection } from "@/features/landing/LandingReviewsSection";
import { LandingTrustSafety } from "@/features/landing/LandingTrustSafety";
import { LandingTrustStrip } from "@/features/landing/LandingTrustStrip";
import { LandingVendorSpotlight } from "@/features/landing/LandingVendorSpotlight";
import { LandingWaitlistCta } from "@/features/landing/LandingWaitlistCta";
import { LandingWhyEventtz } from "@/features/landing/LandingWhyEventtz";
import { ScrollToTopButton } from "@/components/ui/ScrollToTopButton";

export default function LandingMarketplace() {
  return (
    <div className="min-h-dvh bg-page-bg text-neutral-900">
      <LandingNav />
      <LandingHero />
      <LandingTrustStrip />
      <LandingBrowseStrip />
      <LandingWhyEventtz />
      <LandingFeaturedVendors />
      <LandingReviewsSection />
      <LandingInspirationGrid />
      <LandingHowItWorks />
      <LandingVendorSpotlight />
      <LandingTrustSafety />
      <LandingAudienceCta />
      <LandingFaq />
      <LandingWaitlistCta />
      <LandingFooter />
      <ScrollToTopButton />
    </div>
  );
}
