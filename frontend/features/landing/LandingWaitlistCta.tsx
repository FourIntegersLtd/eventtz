"use client";

import { WAITLIST_URL } from "@/features/landing/landingData";
import { LandingSectionHeading } from "@/features/landing/LandingSectionHeading";

export function LandingWaitlistCta() {
  return (
    <section
      id="contact"
      className="border-t border-neutral-200 bg-neutral-50 py-14 sm:py-20 md:py-24 lg:py-32"
    >
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-16">
        <LandingSectionHeading eyebrow="Coming soon" title="Built for African vendors in the UK" />
        <a
          href={WAITLIST_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 inline-flex w-full items-center justify-center rounded-full bg-primary px-6 py-3.5 text-base font-medium text-white transition hover:opacity-90 active:scale-[0.98] sm:mt-10 sm:w-auto sm:px-8 sm:py-4"
        >
          Join the waitlist
        </a>
      </div>
    </section>
  );
}
