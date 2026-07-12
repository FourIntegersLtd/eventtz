"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BROWSE_SECTION, CATEGORIES } from "@/features/landing/landingData";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { LandingSection } from "@/features/landing/LandingSection";
import { LANDING_SECTION_CONTENT_MT, LANDING_STRIP_PY } from "@/features/landing/landingSectionStyles";
import { useCategoryVendorCounts } from "@/features/marketplace/useCategoryVendorCounts";

export function LandingBrowseStrip() {
  const { counts, loading } = useCategoryVendorCounts();

  return (
    <LandingSection id="browse" className={`relative z-10 border-b border-primary-border/40 bg-white ${LANDING_STRIP_PY}`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">
            {BROWSE_SECTION.eyebrow}
          </p>
          <h2 className="font-heading mt-2 text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
            {BROWSE_SECTION.title}
          </h2>
        </div>
        <Link
          href="/client/browse"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition hover:opacity-80"
        >
          View all vendors
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      <div className={`flex flex-wrap justify-center gap-x-6 gap-y-8 sm:flex-nowrap sm:justify-between sm:gap-4 ${LANDING_SECTION_CONTENT_MT}`}>
        {CATEGORIES.map(({ name, value, Icon, iconBg, iconColor }) => (
          <Link
            key={value}
            href={`/client/browse?types=${value}`}
            className="group flex w-[5.5rem] flex-col items-center gap-2.5 sm:w-auto sm:flex-1"
          >
            <span
              className={`flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full shadow-md ring-4 ring-white transition group-hover:scale-105 group-active:scale-95 sm:h-20 sm:w-20 ${iconBg}`}
            >
              <Icon className={`h-7 w-7 sm:h-8 sm:w-8 ${iconColor}`} strokeWidth={1.6} aria-hidden />
            </span>
            <span className="text-center text-sm font-semibold text-neutral-900">{name}</span>
            {!loading ? (
              <span className="text-center text-[11px] text-neutral-500">
                {counts[value] ?? 0} vendor{counts[value] === 1 ? "" : "s"}
              </span>
            ) : (
              <span className="inline-flex items-center justify-center" aria-label="Loading vendor counts">
                <LoadingSpinner size="sm" className="text-neutral-400" />
              </span>
            )}
          </Link>
        ))}
      </div>
    </LandingSection>
  );
}
