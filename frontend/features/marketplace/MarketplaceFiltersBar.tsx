"use client";

import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { MarketplaceSort } from "@/lib/clientExploreApi";
import type { MarketplaceSearchState } from "@/lib/marketplaceSearchParams";

type MarketplaceFiltersBarProps = {
  state: MarketplaceSearchState;
  onCommit: (next: MarketplaceSearchState) => void;
};

const SORT_OPTIONS: { value: MarketplaceSort; label: string }[] = [
  { value: "relevance", label: "Relevance" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "proximity", label: "Proximity" },
  { value: "rating", label: "Rating" },
];

function parseBudget(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number.parseFloat(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Compact "Budget" popover + slim sort dropdown — replaces the old always-open budget/sort box. */
export function MarketplaceFiltersBar(props: MarketplaceFiltersBarProps) {
  return (
    <BudgetSortControls
      key={`${props.state.budgetMin ?? ""}-${props.state.budgetMax ?? ""}`}
      {...props}
    />
  );
}

function BudgetSortControls({ state, onCommit }: MarketplaceFiltersBarProps) {
  const [open, setOpen] = useState(false);
  const [minStr, setMinStr] = useState(() => (state.budgetMin != null ? String(state.budgetMin) : ""));
  const [maxStr, setMaxStr] = useState(() => (state.budgetMax != null ? String(state.budgetMax) : ""));
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const hasBudget = state.budgetMin != null || state.budgetMax != null;

  const apply = () => {
    onCommit({ ...state, budgetMin: parseBudget(minStr), budgetMax: parseBudget(maxStr) });
    setOpen(false);
  };

  const clear = () => {
    setMinStr("");
    setMaxStr("");
    onCommit({ ...state, budgetMin: null, budgetMax: null });
    setOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative" ref={panelRef}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition ${
            hasBudget
              ? "border-primary/30 bg-primary/10 text-primary"
              : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          {hasBudget
            ? `Budget: ${state.budgetMin != null ? `£${state.budgetMin}` : "any"}–${
                state.budgetMax != null ? `£${state.budgetMax}` : "any"
              }`
            : "Budget"}
        </button>
        {open && (
          <div className="absolute right-0 top-full z-[60] mt-2 w-[min(16rem,calc(100vw-2rem))] rounded-2xl border border-neutral-200 bg-white p-4 shadow-lg shadow-neutral-900/5">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Budget (GBP)
            </p>
            <div className="mt-2.5 flex items-center gap-2">
              <input
                type="number"
                min={0}
                step={1}
                inputMode="decimal"
                value={minStr}
                onChange={(e) => setMinStr(e.target.value)}
                placeholder="Min"
                aria-label="Minimum budget"
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 outline-none ring-primary/15 focus:border-primary focus:bg-white focus:ring-2"
              />
              <span className="text-neutral-400">–</span>
              <input
                type="number"
                min={0}
                step={1}
                inputMode="decimal"
                value={maxStr}
                onChange={(e) => setMaxStr(e.target.value)}
                placeholder="Max"
                aria-label="Maximum budget"
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 outline-none ring-primary/15 focus:border-primary focus:bg-white focus:ring-2"
              />
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={clear}
                className="text-sm font-medium text-neutral-500 transition hover:text-neutral-800"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={apply}
                className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-white transition hover:opacity-95"
              >
                Apply
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="relative">
        <select
          aria-label="Sort results"
          value={state.sort}
          onChange={(e) => onCommit({ ...state, sort: e.target.value as MarketplaceSort })}
          className="h-9 appearance-none rounded-full border border-neutral-200 bg-white pl-3.5 pr-8 text-sm font-medium text-neutral-700 outline-none transition hover:bg-neutral-50 focus:border-primary focus:ring-2 focus:ring-primary/15"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400"
          aria-hidden
        />
      </div>
    </div>
  );
}
