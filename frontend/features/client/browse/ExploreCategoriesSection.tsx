"use client";

import type { LucideIcon } from "lucide-react";
import { POPULAR_BROWSE_PILLS } from "@/features/client/browse/browseCategoriesData";

type Category = {
  id: string;
  name: string;
  description: string;
  subtopics: string[];
  Icon: LucideIcon;
  iconBg: string;
  iconColor: string;
};

type ExploreCategoriesSectionProps = {
  categories: Category[];
  query: string;
  onScrollToCategory: (id: string) => void;
};

export function ExploreCategoriesSection({
  categories,
  query,
  onScrollToCategory,
}: ExploreCategoriesSectionProps) {
  return (
    <div className="w-full min-w-0 max-w-full">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Popular</p>
      <div className="mt-3 w-full max-w-full min-w-0 overflow-hidden">
        <div
          className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          role="region"
          aria-label="Popular category shortcuts"
        >
        {POPULAR_BROWSE_PILLS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => onScrollToCategory(p.categoryId)}
            className="inline-flex shrink-0 snap-start items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-xs font-medium text-neutral-800 transition hover:border-primary/40 hover:bg-primary/5 sm:text-sm"
          >
            {p.label}
            <span className="text-neutral-400" aria-hidden>
              →
            </span>
          </button>
        ))}
        </div>
      </div>

      <div className="mt-8 w-full min-w-0 max-w-full">
        <h3 className="font-heading text-lg font-semibold text-neutral-900 sm:text-xl">
          Explore categories
        </h3>

        <div className="mt-6 w-full max-w-full min-w-0 overflow-hidden">
          <div
            className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            role="region"
            aria-label="Explore categories"
          >
          {categories.map((cat) => {
            const Icon = cat.Icon;
            return (
              <article
                key={cat.id}
                id={`category-${cat.id}`}
                className="scroll-mt-28 w-72 shrink-0 snap-start rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:shadow-md sm:w-80"
              >
                <div className="flex gap-4">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center self-start rounded-xl ${cat.iconBg} ${cat.iconColor}`}
                    aria-hidden
                  >
                    <Icon className="h-6 w-6" strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-heading text-base font-semibold leading-snug text-neutral-900">
                      {cat.name}
                    </h4>
                    <p className="mt-1 text-sm leading-snug text-neutral-600">{cat.description}</p>
                    <ul className="mt-4 space-y-1.5 border-t border-neutral-100 pt-4">
                      {cat.subtopics.map((sub) => (
                        <li key={sub}>
                          <button type="button" className="text-left text-sm text-primary hover:underline">
                            {sub}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </article>
            );
          })}
          </div>
        </div>

        {categories.length === 0 && (
          <p className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
            No categories match “{query}”. Try another search.
          </p>
        )}
      </div>
    </div>
  );
}
