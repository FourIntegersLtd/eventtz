"use client";

import {
  CLIENT_JOURNEY_SCROLL_SECTION,
  CLIENT_JOURNEY_SCROLL_STEPS,
} from "@/features/landing/landingData";
import { LandingScrollFeatureShowcase } from "@/features/landing/LandingScrollFeatureShowcase";

export function LandingClientJourneyScroll() {
  return (
    <LandingScrollFeatureShowcase
      id="booking-journey"
      eyebrow={CLIENT_JOURNEY_SCROLL_SECTION.eyebrow}
      title={CLIENT_JOURNEY_SCROLL_SECTION.title}
      description={CLIENT_JOURNEY_SCROLL_SECTION.description}
      summary={CLIENT_JOURNEY_SCROLL_SECTION.summary}
      steps={CLIENT_JOURNEY_SCROLL_STEPS}
      tablistAriaLabel="Client booking journey steps"
      tone="white"
    />
  );
}
