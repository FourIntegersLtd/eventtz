"use client";

import { GALLERY_VIDEOS, INSPIRATION_SECTION } from "@/features/landing/landingData";
import { InspirationVideoShowcase } from "@/features/landing/InspirationVideoShowcase";
import { LandingSectionHeading } from "@/features/landing/LandingSectionHeading";
import { LandingSection } from "@/features/landing/LandingSection";
import { landingSectionClass } from "@/features/landing/landingSectionStyles";

export function LandingInspirationGrid() {
  return (
    <LandingSection
      id="inspiration"
      className={`overflow-x-clip ${landingSectionClass("soft", {
        shell: "content",
        extra: "py-14 sm:py-20 md:py-28",
      })}`}
      width="7xl"
    >
      <LandingSectionHeading
        eyebrow={INSPIRATION_SECTION.eyebrow}
        title={INSPIRATION_SECTION.title}
        className="max-w-xl md:max-w-2xl"
      />
      <InspirationVideoShowcase videos={GALLERY_VIDEOS} />
    </LandingSection>
  );
}
