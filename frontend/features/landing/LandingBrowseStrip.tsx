"use client";

import Link from "next/link";
import { BROWSE_CATEGORIES } from "@/features/landing/landingData";
import { LandingSectionHeading } from "@/features/landing/LandingSectionHeading";
import { LandingSection } from "@/features/landing/LandingSection";
import { useCategoryVendorCounts } from "@/features/marketplace/useCategoryVendorCounts";

export function LandingBrowseStrip() {
  const { counts, loading } = useCategoryVendorCounts();

  return (
    <LandingSection id="browse" className="relative z-10 pt-12 sm:pt-14">
      <LandingSectionHeading eyebrow="Discover" title="Shop by category" align="left" />

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
        {BROWSE_CATEGORIES.map(({ name, value, Icon }) => (
          <Link
            key={name}
            href={`/client/browse?types=${value}`}
            className="group flex flex-col items-center rounded-2xl border border-primary-border bg-white p-4 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-primary-soft sm:p-5"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary transition group-hover:bg-primary/10">
              <Icon className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <span className="mt-3 text-sm font-semibold text-primary transition group-hover:text-violet-900">{name}</span>
            {!loading && (
              <span className="mt-0.5 text-xs text-primary/70">
                {counts[value] ?? 0} vendor{counts[value] === 1 ? "" : "s"}
              </span>
            )}
          </Link>
        ))}
      </div>
    </LandingSection>
  );
}
