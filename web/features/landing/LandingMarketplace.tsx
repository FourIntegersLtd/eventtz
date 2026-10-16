"use client";

import { useEffect } from "react";
import { LandingBrowseStrip } from "@/features/landing/LandingBrowseStrip";
import { LandingClientJourneyScroll } from "@/features/landing/LandingClientJourneyScroll";
import { LandingFaq } from "@/features/landing/LandingFaq";
import { LandingFeaturedVendors } from "@/features/landing/LandingFeaturedVendors";
import { LandingFooter } from "@/features/landing/LandingFooter";
import { LandingHero } from "@/features/landing/LandingHero";
import { LandingInspirationGrid } from "@/features/landing/LandingInspirationGrid";
import { LandingNav } from "@/features/landing/LandingNav";
import { LandingReviewsSection } from "@/features/landing/LandingReviewsSection";
import { LandingVendorSection } from "@/features/landing/LandingVendorSection";
import { LandingWhyEventtz } from "@/features/landing/LandingWhyEventtz";
import { ScrollToTopButton } from "@/components/ui/ScrollToTopButton";

export default function LandingMarketplace() {
  useEffect(() => {
    const scrollToHash = () => {
      const hash = window.location.hash;
      if (!hash) return;
      const target = document.querySelector(hash);
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    requestAnimationFrame(() => requestAnimationFrame(scrollToHash));
    window.addEventListener("hashchange", scrollToHash);
    return () => window.removeEventListener("hashchange", scrollToHash);
  }, []);

  return (
    <div className="min-h-dvh bg-page-bg text-neutral-900">
      <LandingNav variant="solid" />
      <LandingHero />
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
