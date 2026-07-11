"use client";

import { Search } from "lucide-react";

type BrowseSearchBarProps = {
  query: string;
  onQueryChange: (value: string) => void;
};

export function BrowseSearchBar({ query, onQueryChange }: BrowseSearchBarProps) {
  return (
    <div>
      <label htmlFor="browse-search" className="sr-only">
        Search categories and vendors
      </label>
      <div className="relative max-w-2xl">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400"
          strokeWidth={2}
        />
        <input
          id="browse-search"
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search categories and vendors (name, city, services)…"
          className="w-full rounded-xl border border-neutral-200 bg-white py-3.5 pl-12 pr-4 text-sm outline-none ring-primary/15 focus:border-primary focus:ring-2 sm:text-base"
        />
      </div>
    </div>
  );
}
