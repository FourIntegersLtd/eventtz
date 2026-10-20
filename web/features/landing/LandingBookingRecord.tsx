"use client";

import { LandingScreenshotFrame } from "@/features/landing/LandingScreenshotFrame";
import {
  BOOKING_RECORD_JOURNEY,
  BOOKING_RECORD_SECTION,
} from "@/features/landing/landingData";
import { LandingSectionHeading } from "@/features/landing/LandingSectionHeading";
import { LandingSection } from "@/features/landing/LandingSection";
import { CHAT_BUBBLE_MINE, CHAT_BUBBLE_THEIRS } from "@/lib/chatBubbleClasses";

function JourneyPanelMock({ stage }: { stage: "browse" | "chat" | "pay" }) {
  if (stage === "browse") {
    return (
      <div className="p-4 sm:p-5">
        <p className="text-xs font-medium text-neutral-500">Amara&apos;s Kitchen · Catering</p>
        <p className="font-heading mt-1 text-base font-semibold text-primary">Wedding buffet service</p>
        <p className="mt-2 text-sm">
          <span className="text-neutral-400 line-through">GBP 1,200</span>{" "}
          <span className="font-semibold text-primary">GBP 1,080</span>
        </p>
        <span className="mt-3 inline-block rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">
          Request booking
        </span>
      </div>
    );
  }
  if (stage === "chat") {
    return (
      <div className="space-y-3 p-4 sm:p-5">
        <div className={`ml-auto text-xs ${CHAT_BUBBLE_MINE}`}>
          Can you add a vegan tier for 20 guests?
        </div>
        <div className={`max-w-[90%] text-xs ${CHAT_BUBBLE_THEIRS}`}>
          Quote sent · Total GBP 1,240 · Review and accept
        </div>
      </div>
    );
  }
  return (
    <div className="p-4 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Accepted</p>
      <p className="font-heading mt-1 text-base font-semibold text-primary">Pay securely</p>
      <div className="mt-3 space-y-1.5 text-xs text-neutral-600">
        <div className="flex justify-between gap-2">
          <span>Vendor portion</span>
          <span className="font-medium tabular-nums text-neutral-900">£1,240</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>
            Eventtz fee <span className="text-neutral-400">(5%)</span>
          </span>
          <span className="font-medium tabular-nums text-neutral-900">£62</span>
        </div>
        <div className="flex justify-between gap-2 border-t border-neutral-200 pt-1.5 font-semibold text-primary">
          <span>Total due</span>
          <span className="tabular-nums">£1,302</span>
        </div>
      </div>
      <span className="mt-4 inline-block w-full rounded-xl bg-primary py-2.5 text-center text-xs font-semibold text-white">
        Pay now
      </span>
    </div>
  );
}

export function LandingBookingRecord() {
  return (
    <LandingSection
      id="booking-record"
      className="border-t border-primary-border/50 bg-primary-soft/30 py-16 sm:py-20 md:py-24"
    >
      <LandingSectionHeading
        eyebrow={BOOKING_RECORD_SECTION.eyebrow}
        title={BOOKING_RECORD_SECTION.title}
        description={BOOKING_RECORD_SECTION.description}
      />

      <div className="mt-12 grid gap-6 md:grid-cols-3 md:gap-5 lg:mt-14">
        {BOOKING_RECORD_JOURNEY.map((item, index) => (
          <article key={item.title} className="flex flex-col">
            <span className="font-heading text-sm font-semibold tabular-nums text-accent-gold">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h3 className="font-heading mt-2 text-lg font-semibold text-primary">{item.title}</h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-neutral-600">{item.description}</p>
            <div className="mt-5">
              <LandingScreenshotFrame
                imageSrc={item.screenshotSrc}
                imageAlt={item.screenshotAlt}
                fallback={<JourneyPanelMock stage={item.mockStage} />}
                className="shadow-md"
              />
            </div>
          </article>
        ))}
      </div>
    </LandingSection>
  );
}
