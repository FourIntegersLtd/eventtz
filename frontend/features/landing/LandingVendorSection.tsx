"use client";

import { LandingPathsCta } from "@/features/landing/LandingPathsCta";
import { LandingSection } from "@/features/landing/LandingSection";
import { landingSectionClass } from "@/features/landing/landingSectionStyles";

export function LandingVendorSection() {
  return (
    <LandingSection
      id="for-vendors"
      className={landingSectionClass("muted", {
        shell: "content",
        extra: "!py-14 sm:!py-16 md:!py-20",
      })}
      width="7xl"
    >
      <LandingPathsCta />
    </LandingSection>
  );
}
