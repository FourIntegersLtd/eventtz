"use client";

import Link from "next/link";
import { ArrowRight, BadgeCheck, CreditCard, MapPin, Tags } from "lucide-react";
import { BROWSE_SECTION, CATEGORIES } from "@/features/landing/landingData";
import {
  LANDING_HORIZONTAL_PADDING,
  LANDING_PAGE_MAX_WIDTH,
  LANDING_SECTION_CONTENT_MT,
} from "@/features/landing/landingSectionStyles";

const TRUST_ITEMS = [
  { icon: BadgeCheck, label: "Vetted vendors" },
  { icon: CreditCard, label: "Secure payments" },
  { icon: MapPin, label: "UK-wide" },
  { icon: Tags, label: "Real bookings" },
] as const;

export function LandingBrowseStrip() {
  return (
    <section id="browse" className="relative z-10 flex min-h-dvh flex-col bg-white">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-neutral-100/80 to-transparent"
        aria-hidden
      />

      <div
        className={`relative flex flex-1 flex-col justify-center mx-auto w-full ${LANDING_PAGE_MAX_WIDTH} ${LANDING_HORIZONTAL_PADDING} py-16 sm:py-20 lg:py-24`}
      >
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            {BROWSE_SECTION.eyebrow}
          </p>
          <h2 className="font-heading mt-3 text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
            {BROWSE_SECTION.title}
          </h2>
          <p className="mt-3 text-base leading-relaxed text-neutral-600">
            {BROWSE_SECTION.description}
          </p>
          <span className="mx-auto mt-5 block h-px w-12 bg-primary/40" aria-hidden />
        </div>

        <nav
          aria-label="Browse by category"
          className={`flex flex-wrap items-start justify-center gap-x-8 gap-y-9 sm:gap-x-12 sm:gap-y-10 lg:gap-x-14 ${LANDING_SECTION_CONTENT_MT}`}
        >
          {CATEGORIES.map(({ name, value, Icon, iconBg, iconColor }) => (
            <Link
              key={value}
              href={`/client/browse?types=${value}`}
              className="group flex w-[6.5rem] flex-col items-center gap-3 text-center sm:w-[7.25rem]"
            >
              <span
                className={`flex h-[4.75rem] w-[4.75rem] items-center justify-center rounded-full transition duration-300 group-hover:scale-105 group-hover:shadow-md sm:h-[5.25rem] sm:w-[5.25rem] ${iconBg}`}
              >
                <Icon
                  className={`h-7 w-7 transition group-hover:scale-105 sm:h-8 sm:w-8 ${iconColor}`}
                  strokeWidth={1.45}
                  aria-hidden
                />
              </span>
              <span className="font-heading text-[15px] font-semibold text-neutral-900 transition group-hover:text-primary sm:text-base">
                {name}
              </span>
            </Link>
          ))}
        </nav>

        <div className="mt-12 flex justify-center sm:mt-14">
          <Link
            href="/client/browse"
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary transition hover:gap-2.5 hover:opacity-90"
          >
            View all vendors
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>

      {/* Straddles the section border — half in Discover, half into Featured */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 translate-y-1/2">
        <div
          className={`pointer-events-auto mx-auto grid w-full grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 ${LANDING_PAGE_MAX_WIDTH} ${LANDING_HORIZONTAL_PADDING}`}
        >
          {TRUST_ITEMS.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex min-w-0 items-center gap-2.5 rounded-2xl border border-primary-border/80 bg-white px-3 py-3.5 shadow-primary-soft sm:gap-3 sm:px-5 sm:py-5"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary sm:h-10 sm:w-10">
                <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
              </span>
              <span className="truncate text-xs font-semibold text-primary sm:text-sm">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
