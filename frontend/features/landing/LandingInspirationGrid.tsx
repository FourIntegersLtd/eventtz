"use client";

import { GALLERY_VIDEOS, INSPIRATION_SECTION } from "@/features/landing/landingData";
import { InspirationVideoShowcase } from "@/features/landing/InspirationVideoShowcase";
import { LandingSectionHeading } from "@/features/landing/LandingSectionHeading";
import { LandingSection } from "@/features/landing/LandingSection";
import {
  LANDING_SECTION_CONTENT_MT,
  LANDING_SECTION_STACK_MT,
  landingSectionClass,
} from "@/features/landing/landingSectionStyles";

export function LandingInspirationGrid() {
  return (
    <LandingSection
      id="inspiration"
      className={`hidden overflow-x-clip md:block ${landingSectionClass("soft", { shell: "content" })}`}
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
