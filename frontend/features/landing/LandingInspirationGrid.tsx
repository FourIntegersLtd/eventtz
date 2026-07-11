"use client";

import { GALLERY_VIDEOS, INSPIRATION_SECTION } from "@/features/landing/landingData";
import { InspirationVideoShowcase } from "@/features/landing/InspirationVideoShowcase";
import { LandingSectionHeading } from "@/features/landing/LandingSectionHeading";
import { LandingSection } from "@/features/landing/LandingSection";

export function LandingInspirationGrid() {
  return (
    <LandingSection
      id="inspiration"
      className="overflow-x-clip border-t border-primary-border/50 bg-gradient-to-b from-white via-primary-soft/30 to-white py-14 sm:py-20 md:py-24"
      width="7xl"
    >
      <LandingSectionHeading
        eyebrow={INSPIRATION_SECTION.eyebrow}
        title={INSPIRATION_SECTION.title}
      />
      <InspirationVideoShowcase videos={GALLERY_VIDEOS} />
    </LandingSection>
  );
}
