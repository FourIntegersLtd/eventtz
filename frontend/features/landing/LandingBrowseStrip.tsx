"use client";

import Link from "next/link";
import { ArrowRight, BadgeCheck, CreditCard, MapPin, Tags } from "lucide-react";
import { BROWSE_SECTION, CATEGORIES } from "@/features/landing/landingData";
import {
  LANDING_HORIZONTAL_PADDING,
  LANDING_PAGE_MAX_WIDTH,
  LANDING_SECTION_SHELL,
} from "@/features/landing/landingSectionStyles";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";

const TRUST_ITEMS = [
  { icon: BadgeCheck, label: "Vetted vendors" },
  { icon: CreditCard, label: "Secure payments" },
  { icon: MapPin, label: "UK-wide" },
  { icon: Tags, label: "Real bookings" },
] as const;

export function LandingBrowseStrip() {
  return (
    <section
      id="browse"
      className={`${LANDING_SECTION_SHELL.content} z-10 bg-white`}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-neutral-100/80 to-transparent"
        aria-hidden
      />

      <div
        className={`relative mx-auto flex w-full flex-col ${LANDING_PAGE_MAX_WIDTH} ${LANDING_HORIZONTAL_PADDING} py-14 sm:py-16 lg:py-20`}
      >
        <div className="mx-auto w-full max-w-4xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            {BROWSE_SECTION.eyebrow}
          </p>
          <h2 className="font-heading mt-2 text-2xl font-semibold tracking-tight text-neutral-900 sm:mt-3 sm:text-3xl lg:text-4xl">
            {BROWSE_SECTION.title}
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-neutral-600 sm:mt-3 sm:text-base">
            {BROWSE_SECTION.description}
          </p>
          <span className="mx-auto mt-4 block h-px w-12 bg-primary/40" aria-hidden />
        </div>

        <nav
          aria-label="Browse by category"
          className="mt-8 flex w-full flex-wrap items-start justify-center gap-x-8 gap-y-6 sm:mt-10 sm:gap-x-14 sm:gap-y-8 lg:gap-x-16"
        >
          {CATEGORIES.map(({ name, value, Icon, iconBg, iconColor }) => (
            <Link
              key={value}
              href={`/client/browse?types=${value}`}
              className="group flex w-[6.5rem] flex-col items-center gap-2.5 text-center sm:w-[8rem] sm:gap-3"
              onClick={() =>
                track(MixpanelEvents.landing_category_clicked, {
                  vendor_type: value,
                  source: "browse_strip",
                })
              }
            >
              <span
                className={`flex h-16 w-16 items-center justify-center rounded-full transition duration-300 group-hover:scale-105 group-hover:shadow-md sm:h-[5.25rem] sm:w-[5.25rem] ${iconBg}`}
              >
                <Icon
                  className={`h-6 w-6 transition group-hover:scale-105 sm:h-8 sm:w-8 ${iconColor}`}
                  strokeWidth={1.45}
                  aria-hidden
                />
              </span>
              <span className="font-heading text-sm font-semibold text-neutral-900 transition group-hover:text-primary sm:text-base">
                {name}
              </span>
            </Link>
          ))}
        </nav>

        <div className="mt-8 flex justify-center pb-6 sm:mt-10 sm:pb-8">
          <Link
            href="/client/browse"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary transition hover:gap-2.5 hover:opacity-90"
            onClick={() =>
              track(MixpanelEvents.landing_cta_clicked, {
                cta: "view_all",
                location: "browse_strip",
              })
            }
          >
            View all categories
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>

      {/* In-flow on mobile; straddles the border from sm up */}
      <div className="relative z-20 mt-4 pb-2 sm:absolute sm:inset-x-0 sm:bottom-0 sm:mt-0 sm:translate-y-1/2 sm:pb-0">
        <div
          className={`mx-auto grid w-full grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-4 ${LANDING_PAGE_MAX_WIDTH} ${LANDING_HORIZONTAL_PADDING}`}
        >
          {TRUST_ITEMS.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex min-w-0 items-center justify-center gap-2 rounded-2xl border border-primary-border/80 bg-white px-3 py-3 text-center shadow-primary-soft sm:gap-3 sm:px-5 sm:py-4"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary sm:h-10 sm:w-10">
                <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
              </span>
              <span className="text-[11px] font-semibold leading-snug text-primary sm:text-sm">
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
