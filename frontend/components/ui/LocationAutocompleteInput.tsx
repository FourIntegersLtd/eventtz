"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Building2, X, type LucideIcon } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { fetchUkLocationSuggestions } from "@/lib/photonLocationAutocomplete";

type Suggestion = { label: string; value: string };

type MenuRect = { top: number; left: number; width: number };

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

const DEFAULT_INPUT_CLASS =
  "w-full rounded-lg border border-neutral-200 py-2 pl-9 pr-10 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-neutral-50 disabled:text-neutral-500";

export type LocationAutocompleteInputProps = {
  /** Visible label above the field. Omit for compact/inline usage (e.g. a search bar) and pass `ariaLabel` instead. */
  label?: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  helpText?: string;
  inputId?: string;
  autoComplete?: string;
  disabled?: boolean;
  /** Accessible name when no visible `label` is rendered. */
  ariaLabel?: string;
  /** Icon shown inside the field. Defaults to a building icon. */
  icon?: LucideIcon;
  /** Override the icon's classes (e.g. to recolor for a dark search bar). */
  iconClassName?: string;
  /** Override the input's classes entirely — use this to embed the field in a custom bar/pill. */
  inputClassName?: string;
  /** Outer wrapper classes (defaults to `relative`). */
  className?: string;
  /** Hide the clear ("x") button. Defaults to shown. */
  showClear?: boolean;
};

/**
 * UK city/area autocomplete (Photon/OSM place search) — the one reusable location field for
 * every "city or area" input in the app (vendor onboarding, marketplace search, etc). Free text
 * is always accepted; suggestions are just a fast way to pick a recognised place.
 */
export function LocationAutocompleteInput({
  label,
  value,
  onChange,
  placeholder,
  helpText,
  inputId,
  autoComplete,
  disabled,
  ariaLabel,
  icon: Icon = Building2,
  iconClassName = "text-neutral-400",
  inputClassName,
  className,
  showClear = true,
}: LocationAutocompleteInputProps) {
  const reactId = useId();
  const id = inputId ?? `location-ac-${reactId}`;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuRect, setMenuRect] = useState<MenuRect | null>(null);
  const [fetchedSuggestions, setFetchedSuggestions] = useState<Suggestion[]>([]);
  const debouncedQuery = useDebouncedValue(value, 220);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const queryLongEnough = debouncedQuery.trim().length >= 2;
  const suggestions = open && queryLongEnough ? fetchedSuggestions : [];
  const showMenu = suggestions.length > 0;

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateMenuRect = () => {
    const anchor = anchorRef.current;
    if (!anchor) {
      setMenuRect(null);
      return;
    }
    const rect = anchor.getBoundingClientRect();
    setMenuRect({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  };

  useLayoutEffect(() => {
    if (!showMenu) {
      setMenuRect(null);
      return;
    }
    updateMenuRect();
    window.addEventListener("resize", updateMenuRect);
    window.addEventListener("scroll", updateMenuRect, true);
    return () => {
      window.removeEventListener("resize", updateMenuRect);
      window.removeEventListener("scroll", updateMenuRect, true);
    };
  }, [showMenu, suggestions.length, value]);

  useEffect(() => {
    if (!open || !queryLongEnough) return;
    let cancelled = false;
    void (async () => {
      setBusy(true);
      try {
        const items = await fetchUkLocationSuggestions(debouncedQuery.trim());
        if (!cancelled) setFetchedSuggestions(items);
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, open, queryLongEnough]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const showClearButton = useMemo(
    () => showClear && value.trim().length > 0,
    [showClear, value],
  );

  const suggestionsMenu =
    mounted && showMenu && menuRect
      ? createPortal(
          <div
            ref={listRef}
            className="overflow-hidden rounded-xl border border-neutral-200 bg-white text-left shadow-2xl ring-1 ring-black/10"
            style={{
              position: "fixed",
              top: menuRect.top,
              left: menuRect.left,
              width: menuRect.width,
              zIndex: 9999,
            }}
          >
            <ul
              id={`${id}-listbox`}
              className="max-h-60 overflow-y-auto bg-white py-1"
              role="listbox"
            >
              {suggestions.map((s, i) => (
                <li key={`${s.value}-${i}`} role="presentation" className="bg-white">
                  <button
                    type="button"
                    role="option"
                    className="flex w-full items-center justify-between gap-3 bg-white px-3 py-2.5 text-left text-sm text-neutral-900 hover:bg-neutral-50"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setOpen(false);
                      onChange(s.value);
                    }}
                  >
                    <span className="min-w-0 truncate">{s.label}</span>
                    <span className="shrink-0 text-xs text-neutral-400">Select</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className={className ?? "relative"}>
      {label ? (
        <label
          htmlFor={id}
          className="block text-xs font-semibold uppercase tracking-wide text-neutral-500"
        >
          {label}
        </label>
      ) : null}
      <div ref={anchorRef} className={`relative ${label ? "mt-1.5" : ""}`}>
        <Icon
          className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${iconClassName}`}
          aria-hidden
        />
        <input
          id={id}
          type="text"
          autoComplete={autoComplete ?? "off"}
          aria-label={label ? undefined : ariaLabel}
          aria-expanded={showMenu}
          aria-controls={showMenu ? `${id}-listbox` : undefined}
          value={value}
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          placeholder={placeholder ?? "Start typing a city or town…"}
          className={inputClassName ?? DEFAULT_INPUT_CLASS}
        />
        {busy ? (
          <LoadingSpinner
            size="sm"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400"
          />
        ) : showClearButton ? (
          <button
            type="button"
            onClick={() => {
              onChange("");
              setFetchedSuggestions([]);
              setOpen(false);
            }}
            className="absolute right-2 top-1/2 inline-flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
            aria-label="Clear"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      {helpText ? <p className="mt-1 text-xs text-neutral-500">{helpText}</p> : null}
      {suggestionsMenu}
    </div>
  );
}
