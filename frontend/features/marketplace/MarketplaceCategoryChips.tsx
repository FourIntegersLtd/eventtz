"use client";

import { CATEGORIES } from "@/features/landing/landingData";
import { useCategoryVendorCounts } from "@/features/marketplace/useCategoryVendorCounts";

type MarketplaceCategoryChipsProps = {
  selectedTypes: string[];
  onToggle: (value: string) => void;
};

/** Quick category filter chips above the search bar — mirrors the landing page's "browse by category" cards. */
export function MarketplaceCategoryChips({ selectedTypes, onToggle }: MarketplaceCategoryChipsProps) {
  const { counts, loading } = useCategoryVendorCounts();

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {CATEGORIES.map(({ name, value, Icon }) => {
        const active = selectedTypes.includes(value);
        return (
          <button
            key={value}
            type="button"
            onClick={() => onToggle(value)}
            aria-pressed={active}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${
              active
                ? "bg-primary text-white"
                : "bg-white text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-50"
            }`}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            {name}
            {!loading && (
              <span className={active ? "text-white/80" : "text-neutral-400"}>
                {counts[value] ?? 0}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
