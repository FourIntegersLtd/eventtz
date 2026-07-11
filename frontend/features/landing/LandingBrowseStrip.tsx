"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CATEGORIES } from "@/features/landing/landingData";
import { LandingSection } from "@/features/landing/LandingSection";
import { useCategoryVendorCounts } from "@/features/marketplace/useCategoryVendorCounts";

export function LandingBrowseStrip() {
  const { counts, loading } = useCategoryVendorCounts();

  return (
    <LandingSection id="browse" className="relative z-10 border-b border-primary-border/40 bg-white pb-14 pt-10 sm:pb-16 sm:pt-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">
            Discover
          </p>
          <h2 className="font-heading mt-2 text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
            Shop by category
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

      <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-8 sm:mt-10 sm:flex-nowrap sm:justify-between sm:gap-4">
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
              <span className="h-3 w-12 animate-pulse rounded bg-neutral-200" aria-hidden />
            )}
          </Link>
        ))}
      </div>
    </LandingSection>
  );
}
