"use client";

import { LandingAudienceCta } from "@/features/landing/LandingAudienceCta";
import { LandingBookRequest } from "@/features/landing/LandingBookRequest";
import { LandingBrowseStrip } from "@/features/landing/LandingBrowseStrip";
import { LandingFaq } from "@/features/landing/LandingFaq";
import { LandingFeaturedVendors } from "@/features/landing/LandingFeaturedVendors";
import { LandingFooter } from "@/features/landing/LandingFooter";
import { LandingHero } from "@/features/landing/LandingHero";
import { LandingHowItWorks } from "@/features/landing/LandingHowItWorks";
import { LandingInspirationGrid } from "@/features/landing/LandingInspirationGrid";
import { LandingNav } from "@/features/landing/LandingNav";
import { LandingPricingTrust } from "@/features/landing/LandingPricingTrust";
import { LandingQuoteAccept } from "@/features/landing/LandingQuoteAccept";
import { LandingReviewsSection } from "@/features/landing/LandingReviewsSection";
import { LandingTrustSafety } from "@/features/landing/LandingTrustSafety";
import { LandingTrustStrip } from "@/features/landing/LandingTrustStrip";
import { LandingVendorSpotlight } from "@/features/landing/LandingVendorSpotlight";
import { LandingVendorTools } from "@/features/landing/LandingVendorTools";
// import { LandingWaitlistCta } from "@/features/landing/LandingWaitlistCta";
import { LandingWhyEventtz } from "@/features/landing/LandingWhyEventtz";
import { ScrollToTopButton } from "@/components/ui/ScrollToTopButton";

export default function LandingMarketplace() {
  return (
    <div className="min-h-dvh overflow-x-hidden bg-page-bg text-neutral-900">
      <LandingNav />
      <LandingHero />
      <LandingTrustStrip />
      <LandingBrowseStrip />
      <LandingFeaturedVendors />
      <LandingReviewsSection />
      <LandingHowItWorks />
      <LandingPricingTrust />
      <LandingBookRequest />
      <LandingQuoteAccept />
      <LandingWhyEventtz />
      <LandingTrustSafety />
      <LandingInspirationGrid />
      <LandingVendorSpotlight />
      <LandingVendorTools />
      <LandingAudienceCta />
      <LandingFaq />
      {/* <LandingWaitlistCta /> */}
      <LandingFooter />
      <ScrollToTopButton />
    </div>
  );
}
