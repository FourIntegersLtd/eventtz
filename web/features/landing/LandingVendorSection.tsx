"use client";

import { LandingPathsCta } from "@/features/landing/LandingPathsCta";
import { LandingSection } from "@/components/landing/LandingSection";
import { landingSectionClass } from "@/components/landing/landingSectionStyles";

export function LandingVendorSection() {
  return (
    <LandingSection
      id="for-vendors"
      className={landingSectionClass("brand", {
        shell: "content",
        extra: "!py-14 sm:!py-16 md:!py-20",
      })}
      width="7xl"
    >
      <LandingPathsCta />
    </LandingSection>
  );
}
