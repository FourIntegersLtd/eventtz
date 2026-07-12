"use client";

import { BOOK_SECTION } from "@/features/landing/landingData";
import { LandingFeatureSplit } from "@/features/landing/LandingFeatureSplit";

export function LandingBookRequest() {
  return (
    <LandingFeatureSplit
      id="book-request"
      variant="stacked"
      title={BOOK_SECTION.title}
      description={BOOK_SECTION.description}
      imageSrc={BOOK_SECTION.screenshotSrc}
      imageAlt="Request a booking on Eventtz"
      ctaHref={BOOK_SECTION.ctaHref}
      ctaLabel={BOOK_SECTION.ctaLabel}
      tone="muted"
    />
  );
}
