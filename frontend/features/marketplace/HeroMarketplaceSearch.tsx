"use client";

import { Calendar, ChevronDown, Search, Tags, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  categoryChipLabel,
  MarketplaceCategoryFilterFields,
} from "@/features/marketplace/MarketplaceCategoryFilterFields";
import {
  dateChipLabel,
  MarketplaceDateFilterFields,
} from "@/features/marketplace/MarketplaceDateFilterFields";
import {
  buildMarketplaceSearchUrl,
  type MarketplaceSearchState,
} from "@/lib/marketplaceSearchParams";
import { DEFAULT_COUNTRY_CODE } from "@/lib/markets";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";
import { RotatingSearchPlaceholder } from "@/features/marketplace/RotatingSearchPlaceholder";

type HeroMarketplaceSearchProps = {
  variant?: "landing" | "default";
  /** Path for search submit - always `/client/browse`, the one canonical marketplace route. */
  submitToPath: string;
  className?: string;
  /** Initial values when the parent remounts this component (e.g. `key={urlQuery}`). */
  initialState?: MarketplaceSearchState;
  submitMode?: "push" | "replace";
  /** Hide the vendor-type dropdown - category chips / popular searches cover this. */
  showTypesField?: boolean;
  /** Show event-date picker (optional filter for availability). */
  showDatesField?: boolean;
};

const emptyState = (): MarketplaceSearchState => ({
  query: "",
  types: [],
  location: "",
  country: DEFAULT_COUNTRY_CODE,
  dates: [],
  dateFlexible: false,
  budgetMin: null,
  budgetMax: null,
  sort: "relevance",
  page: 1,
  vendorIds: [],
  fromPlannerPlanId: null,
  eventName: "",
  venue: "",
  planNotes: "",
  linkedEventId: null,
});

export function HeroMarketplaceSearch({
  variant = "default",
  submitToPath,
  className = "",
  initialState,
  submitMode = "push",
  showTypesField = false,
  showDatesField = true,
}: HeroMarketplaceSearchProps) {
  const router = useRouter();
  const panelId = useId();
  const datePanelId = useId();
  const [state, setState] = useState<MarketplaceSearchState>(
    () => initialState ?? emptyState(),
  );
  const [typesOpen, setTypesOpen] = useState(false);
  const [datesOpen, setDatesOpen] = useState(false);
  const typesRef = useRef<HTMLDivElement>(null);
  const datesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (typesRef.current?.contains(t) || datesRef.current?.contains(t)) return;
      setTypesOpen(false);
      setDatesOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const landing = variant === "landing";

  const visibleFieldCount =
    (showTypesField ? 1 : 0) + 1 + (showDatesField ? 1 : 0);

  const gridColsForFieldCount = (count: number) => {
    switch (count) {
      case 1:
        return "lg:grid-cols-[minmax(0,1fr)_auto]";
      case 2:
        return "lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.85fr)_auto]";
      case 3:
        return "lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)_minmax(0,0.85fr)_auto]";
      default:
        return "lg:grid-cols-[minmax(0,1fr)_auto]";
    }
  };

  const responsiveGridCols = gridColsForFieldCount(visibleFieldCount);

  const shellClassName = `grid w-full min-w-0 max-w-full grid-cols-1 gap-2 overflow-visible rounded-2xl border border-primary-border bg-white p-2 shadow-primary-soft ${responsiveGridCols} lg:items-center lg:gap-0 lg:rounded-full lg:py-1.5 lg:pl-1.5 lg:pr-3`;

  const submitSpanClass = "lg:col-span-1";
  const fieldClassName = "relative z-20 min-w-0";
  const fieldDivider = "lg:border-l lg:border-primary-border";
  const submitClassName = `flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-white transition hover:opacity-95 sm:px-6 ${submitSpanClass} lg:w-auto lg:justify-self-end lg:px-6`;
  const dropdownTriggerClassName = `flex h-12 w-full items-center justify-between gap-2 rounded-xl px-4 text-left text-sm font-medium text-neutral-900 lg:rounded-none lg:bg-transparent ${fieldDivider}`;
  const queryInputClassName =
    "relative z-[1] h-12 w-full rounded-xl border-0 bg-transparent py-3 pl-11 pr-4 text-base text-neutral-900 caret-neutral-900 focus:border-0 focus:outline-none focus:ring-0 lg:rounded-none";

  const toggleType = useCallback((value: string) => {
    setState((s) => {
      const set = new Set(s.types);
      if (set.has(value)) set.delete(value);
      else set.add(value);
      return { ...s, types: [...set] };
    });
  }, []);

  const typesSummary = useMemo(() => {
    if (state.types.length === 0) return "All vendor types";
    return categoryChipLabel(state.types);
  }, [state.types]);
  const datesSummary = useMemo(
    () => dateChipLabel(state.dates, state.dateFlexible),
    [state.dates, state.dateFlexible],
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const hasCriteria =
      state.query.trim().length > 0 ||
      state.location.trim().length > 0 ||
      state.types.length > 0 ||
      state.dates.length > 0 ||
      state.dateFlexible ||
      state.budgetMin != null ||
      state.budgetMax != null;
    if (!hasCriteria) return;
    track(MixpanelEvents.marketplace_search_submitted, {
      source: landing ? "landing" : "browse",
      has_query: state.query.trim().length > 0,
      has_location: state.location.trim().length > 0,
      type_count: state.types.length,
      date_count: state.dates.length,
      date_flexible: state.dateFlexible,
      has_budget: state.budgetMin != null || state.budgetMax != null,
    });
    const url = buildMarketplaceSearchUrl(submitToPath, { ...state, page: 1 });

    if (submitMode === "replace") router.replace(url);
    else router.push(url);
  };

  return (
    <form
      onSubmit={onSubmit}
      className={`flex w-full min-w-0 max-w-full flex-col gap-3 ${className}`}
    >
      <div className={shellClassName}>
        {/* Types */}
        {showTypesField && (
        <div className={fieldClassName} ref={typesRef}>
          <button
            type="button"
            aria-expanded={typesOpen}
            aria-controls={panelId}
            onClick={() => {
              setTypesOpen((o) => !o);
              setDatesOpen(false);
            }}
            className={dropdownTriggerClassName}
          >
            <span className="flex min-w-0 items-center gap-2">
              <Tags className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate">{typesSummary}</span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-neutral-600 opacity-70" />
          </button>
          {typesOpen && (
            <div
              id={panelId}
              className={
                landing
                  ? "absolute bottom-full left-0 right-0 z-[70] mb-1 box-border min-w-0 max-w-full max-h-72 overflow-y-auto rounded-xl border border-neutral-200 bg-white p-2 shadow-lg"
                  : "absolute left-0 right-0 top-full z-[70] mt-1 box-border min-w-0 max-w-full max-h-72 overflow-y-auto rounded-xl border border-neutral-200 bg-white p-2 shadow-lg"
              }
            >
              <MarketplaceCategoryFilterFields
                types={state.types}
                showOtherOption
                onToggleType={toggleType}
              />
            </div>
          )}
        </div>
        )}

        {/* Free-text search - vendor name, city, or services (not place autocomplete) */}
        <div className={`relative ${fieldClassName}`}>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-primary"
            aria-hidden
          />
          <RotatingSearchPlaceholder
            visible={!state.query.trim()}
            compact={!landing}
          />
          <input
            id="hero-query"
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            aria-label="Search vendors"
            value={state.query}
            onChange={(e) => setState((s) => ({ ...s, query: e.target.value }))}
            placeholder=""
            className={queryInputClassName}
          />
        </div>

        {/* Dates */}
        {showDatesField ? (
        <div className={fieldClassName} ref={datesRef}>
          <button
            type="button"
            aria-expanded={datesOpen}
            aria-controls={datePanelId}
            onClick={() => {
              setDatesOpen((o) => !o);
              setTypesOpen(false);
            }}
            className={dropdownTriggerClassName}
          >
            <span className="flex items-center gap-2 truncate">
              <Calendar className="h-4 w-4 shrink-0 text-primary" />
              {state.dates.length === 0 && !state.dateFlexible ? "Event date" : datesSummary}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
          </button>
          {datesOpen && (
            <div
              id={datePanelId}
              className={
                landing
                  ? "absolute bottom-full left-0 right-0 z-[70] mb-1 box-border min-w-0 max-w-full rounded-xl border border-neutral-200 bg-white p-3 shadow-lg"
                  : "absolute left-0 right-0 top-full z-[70] mt-1 box-border min-w-0 max-w-full rounded-xl border border-neutral-200 bg-white p-3 shadow-lg"
              }
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-neutral-500">Pick a date</p>
                <button
                  type="button"
                  aria-label="Close date picker"
                  onClick={() => {
                    setDatesOpen(false);
                  }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <MarketplaceDateFilterFields
                dates={state.dates}
                dateFlexible={state.dateFlexible}
                onChange={({ dates, dateFlexible }) =>
                  setState((s) => ({ ...s, dates, dateFlexible }))
                }
                closeOnPick
                onClose={() => setDatesOpen(false)}
              />
            </div>
          )}
        </div>
        ) : null}

        <button type="submit" className={submitClassName}>
          <Search className="h-5 w-5" strokeWidth={2.5} />
          Search
        </button>
      </div>

      {landing && (
        <p className="mt-3 text-center text-xs text-neutral-500 sm:text-sm">
          Plan an event or search vendors in plain English
        </p>
      )}
    </form>
  );
}
