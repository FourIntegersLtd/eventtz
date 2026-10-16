"use client";

import Link from "next/link";
import { CATEGORIES } from "@/features/landing/landingData";
import { LandingSectionHeading } from "@/features/landing/LandingSectionHeading";
import { useCategoryVendorCounts } from "@/features/marketplace/useCategoryVendorCounts";

export function LandingCategoriesSection() {
  const { counts, loading } = useCategoryVendorCounts();

  return (
    <section
      id="categories"
      className="relative border-t border-neutral-200 bg-neutral-50 py-14 sm:py-16 sm:px-4 md:py-20 md:px-6 lg:py-24 lg:px-16"
    >
      <div className="mx-auto max-w-6xl px-4">
        <LandingSectionHeading
          eyebrow="Browse by category"
          title="Find vendors for every occasion"
        />
        <div className="mt-10 grid grid-cols-2 gap-5 sm:mt-12 sm:gap-6 md:grid-cols-3 lg:grid-cols-5 md:gap-8">
          {CATEGORIES.map(({ name, value, Icon, description, iconBg, iconColor }) => (
            <Link
              key={name}
              href={`/client/browse?types=${value}`}
              className="flex flex-col items-center rounded-2xl border border-neutral-200 bg-white p-3 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99] sm:items-start sm:text-left sm:p-5 md:p-6"
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-12 sm:w-12 ${iconBg} ${iconColor}`}
              >
                <Icon className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.5} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 sm:mt-3">
                <h3 className="font-heading text-base font-semibold text-neutral-900 sm:text-lg">
                  {name}
                </h3>
                {!loading && (
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
                    {counts[value] ?? 0}
                  </span>
                )}
              </div>
              <p className="mt-1 hidden text-sm leading-snug text-neutral-600 sm:block">{description}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
