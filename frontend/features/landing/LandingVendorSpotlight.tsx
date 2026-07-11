"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { VENDOR_SPOTLIGHT_BENEFITS } from "@/features/landing/landingData";
import { LandingSectionHeading } from "@/features/landing/LandingSectionHeading";
import { LandingSection } from "@/features/landing/LandingSection";

export function LandingVendorSpotlight() {
  return (
    <LandingSection
      id="for-vendors"
      className="hidden border-t border-primary-border/50 bg-primary-soft py-16 sm:py-20 md:block md:py-24"
      width="6xl"
    >
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center lg:gap-14">
        <div>
          <LandingSectionHeading
            eyebrow="For vendors"
            title="Grow your event business on Eventtz"
            description="List your services, get found by clients planning celebrations across the UK, and manage bookings and payouts in one place."
            align="left"
          />
          <Link
            href="/register?type=vendor"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Join as a vendor
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {VENDOR_SPOTLIGHT_BENEFITS.map(({ title, description, Icon }) => (
            <article
              key={title}
              className="rounded-2xl border border-primary-border bg-white p-5 shadow-sm"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              </span>
              <h3 className="font-heading mt-3 text-base font-semibold text-primary">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{description}</p>
            </article>
          ))}
        </div>
      </div>
    </LandingSection>
  );
}
