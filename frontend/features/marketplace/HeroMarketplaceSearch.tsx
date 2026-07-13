"use client";

import { Calendar, ChevronDown, Search, Tags } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { SERVICE_OPTIONS, VENDOR_WAITLIST_URL } from "@/components/vendor-onboarding/constants";
import {
  buildMarketplaceSearchUrl,
  type MarketplaceSearchState,
} from "@/lib/marketplaceSearchParams";
import { EVENT_DATE_PAST_ERROR, isPastIsoDate, todayIsoDate } from "@/lib/eventDateValidation";
import { formatEventDate } from "@/lib/dateFormat";
import { DateInput } from "@/components/ui/DateInput";

const OTHER_TOOLTIP =
  "We’re expanding categories. Join the waitlist to hear when your vendor type goes live.";

type HeroMarketplaceSearchProps = {
  variant?: "landing" | "default";
  /** Path for search submit — always `/client/browse`, the one canonical marketplace route. */
  submitToPath: string;
  className?: string;
  /** Initial values when the parent remounts this component (e.g. `key={urlQuery}`). */
  initialState?: MarketplaceSearchState;
  submitMode?: "push" | "replace";
  /** Hide the vendor-type dropdown — category chips / popular searches cover this. */
  showTypesField?: boolean;
  /** Show event-date picker (optional filter for availability). */
  showDatesField?: boolean;
};

const emptyState = (): MarketplaceSearchState => ({
  query: "",
  types: [],
  location: "",
  dates: [],
  dateFlexible: false,
  budgetMin: null,
  budgetMax: null,
  sort: "relevance",
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
  const [datePickerError, setDatePickerError] = useState<string | null>(null);
  const [draftEventDate, setDraftEventDate] = useState(() => todayIsoDate());
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

  const shellClassName = landing
    ? `grid w-full min-w-0 max-w-full grid-cols-1 gap-2 overflow-visible rounded-2xl border border-primary-border bg-white p-2 shadow-primary-soft ${responsiveGridCols} lg:items-center lg:gap-0 lg:rounded-full lg:p-1.5`
    : `grid min-w-0 max-w-full grid-cols-1 gap-3 overflow-visible rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm sm:grid-cols-2 ${responsiveGridCols} lg:items-end`;

  const submitSpanClass = landing
    ? "lg:col-span-1"
    : visibleFieldCount === 1
      ? "sm:col-span-1"
      : "sm:col-span-2";
  const fieldClassName = "relative z-20 min-w-0";
  const landingFieldDivider = landing ? "lg:border-l lg:border-primary-border" : "";
  const submitClassName = landing
    ? `flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-white transition hover:opacity-95 sm:px-6 ${submitSpanClass} lg:w-auto lg:justify-self-end lg:px-6`
    : `flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-white transition hover:opacity-95 ${submitSpanClass} lg:col-span-1 lg:w-auto lg:justify-self-end`;

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
    const labels = state.types
      .map((v) => SERVICE_OPTIONS.find((o) => o.value === v)?.label ?? v)
      .slice(0, 3);
    const extra = state.types.length > 3 ? ` +${state.types.length - 3}` : "";
    return `${labels.join(", ")}${extra}`;
  }, [state.types]);

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
    const url = buildMarketplaceSearchUrl(submitToPath, state);
    if (submitMode === "replace") router.replace(url);
    else router.push(url);
  };

  const addDraftDate = () => {
    if (!draftEventDate) return;
    if (isPastIsoDate(draftEventDate)) {
      setDatePickerError(EVENT_DATE_PAST_ERROR);
      return;
    }
    setDatePickerError(null);
    setState((s) => {
      if (s.dateFlexible) return { ...s, dates: [draftEventDate], dateFlexible: false };
      const next = [...s.dates.filter((d) => d !== draftEventDate), draftEventDate].slice(0, 3);
      return { ...s, dates: next };
    });
    setDraftEventDate(todayIsoDate());
  };

  const removeDate = (iso: string) => {
    setState((s) => ({ ...s, dates: s.dates.filter((d) => d !== iso) }));
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
            className={
              landing
                ? `flex h-12 w-full items-center justify-between gap-2 rounded-xl px-4 text-left text-sm font-medium text-neutral-900 lg:rounded-none lg:bg-transparent ${landingFieldDivider}`
                : "flex h-12 w-full items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-left text-sm text-neutral-900"
            }
          >
            <span className="flex min-w-0 items-center gap-2">
              <Tags
                className={`h-4 w-4 shrink-0 ${landing ? "text-primary" : "text-primary"}`}
              />
              <span className="truncate">{typesSummary}</span>
            </span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 opacity-70 ${landing ? "text-neutral-600" : ""}`}
            />
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
              {SERVICE_OPTIONS.map((opt) =>
                opt.value === "other" ? (
                  <div
                    key={opt.value}
                    className="flex items-center justify-between gap-2 rounded-lg px-2 py-2"
                  >
                    <span
                      className="text-sm text-neutral-700"
                      title={OTHER_TOOLTIP}
                    >
                      Other
                    </span>
                    <Link
                      href={VENDOR_WAITLIST_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-primary hover:underline"
                      onClick={() => setTypesOpen(false)}
                    >
                      Waitlist
                    </Link>
                  </div>
                ) : (
                  <label
                    key={opt.value}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 hover:bg-neutral-50"
                  >
                    <input
                      type="checkbox"
                      checked={state.types.includes(opt.value)}
                      onChange={() => toggleType(opt.value)}
                      className="rounded border-neutral-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm text-neutral-800">{opt.label}</span>
                  </label>
                ),
              )}
            </div>
          )}
        </div>
        )}

        {/* Free-text search — vendor name, city, or services (not place autocomplete) */}
        <div className={`relative ${fieldClassName}`}>
          <Search
            className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${
              landing ? "text-primary" : "text-neutral-400"
            }`}
            aria-hidden
          />
          <input
            id="hero-query"
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            aria-label="Search vendors"
            value={state.query}
            onChange={(e) => setState((s) => ({ ...s, query: e.target.value }))}
            placeholder="Search vendors or city"
            className={
              landing
                ? "h-12 w-full rounded-xl border-0 bg-transparent py-3 pl-11 pr-4 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-0 focus:outline-none focus:ring-0 lg:rounded-none"
                : "h-12 w-full rounded-xl border border-neutral-200 bg-white py-2 pl-10 pr-4 text-sm text-neutral-900 outline-none ring-primary/15 focus:border-primary focus:ring-2"
            }
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
            className={
              landing
                ? `flex h-12 w-full items-center justify-between gap-2 rounded-xl px-4 text-left text-sm font-medium text-neutral-900 lg:rounded-none lg:bg-transparent ${landingFieldDivider}`
                : "flex h-12 w-full items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-left text-sm text-neutral-900"
            }
          >
            <span className="flex items-center gap-2 truncate">
              <Calendar
                className={`h-4 w-4 shrink-0 ${landing ? "text-primary" : "text-primary"}`}
              />
              {state.dateFlexible
                ? "Flexible on dates"
                : state.dates.length === 0
                  ? "Event dates"
                  : `${state.dates.length} date(s)`}
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
              <p className="text-xs font-medium text-neutral-500">
                Up to 3 dates
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {state.dates.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => removeDate(d)}
                    className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                  >
                    {formatEventDate(d)} ×
                  </button>
                ))}
              </div>
              {state.dates.length < 3 && !state.dateFlexible ? (
                <div className="mt-2 min-w-0 space-y-2">
                  <DateInput
                    value={draftEventDate}
                    min={todayIsoDate()}
                    onChange={(e) => {
                      setDraftEventDate(e.target.value);
                      setDatePickerError(null);
                    }}
                  />
                  <button
                    type="button"
                    onClick={addDraftDate}
                    className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary transition hover:bg-primary/15"
                  >
                    Add this date
                  </button>
                </div>
              ) : null}
              {datePickerError ? (
                <p className="mt-2 text-xs font-medium text-red-600">{datePickerError}</p>
              ) : null}
              <label className="mt-3 flex cursor-pointer items-center gap-2 border-t border-neutral-100 pt-3 text-sm text-neutral-800">
                <input
                  type="checkbox"
                  checked={state.dateFlexible}
                  onChange={(e) =>
                    setState((s) => ({
                      ...s,
                      dateFlexible: e.target.checked,
                      dates: e.target.checked ? [] : s.dates,
                    }))
                  }
                  className="rounded border-neutral-300 text-primary"
                />
                I&apos;m flexible on dates
              </label>
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
        <p className="mt-3 text-center text-xs text-neutral-500">
          <Link href="/client/browse" className="font-medium text-primary underline-offset-2 hover:underline">
            Browse all vendors
          </Link>
        </p>
      )}
    </form>
  );
}
