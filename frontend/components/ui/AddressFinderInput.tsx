"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MapPin, Loader2, X } from "lucide-react";
import {
  fetchAddressAutocomplete,
  fetchAddressFindByPostcode,
  fetchAddressResolve,
} from "@/lib/addressApi";

type SuggestionSource = "find" | "autocomplete" | "postcode";

type Suggestion = {
  id: string | null;
  label: string;
  source: SuggestionSource;
};

function normalizePostcodeLike(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

/** Loose check before calling OS Places postcode search (avoids noisy requests). */
function shouldTryPostcodeFind(q: string): boolean {
  const t = q.trim().replace(/\s+/g, "").toUpperCase();
  if (t.length < 5 || t.length > 7) return false;
  return /\d[A-Z]{2}$/.test(t);
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

async function fetchPostcodeOnlySuggestions(query: string): Promise<Suggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const res = await fetch(
    `https://api.postcodes.io/postcodes/${encodeURIComponent(q)}/autocomplete`,
    { method: "GET" },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { status?: number; result?: string[] };
  const items = Array.isArray(data.result) ? data.result : [];
  return items.slice(0, 6).map((pc) => ({
    id: null,
    label: pc,
    source: "postcode" as const,
  }));
}

type FetchAllResult = {
  suggestions: Suggestion[];
  /** Set when the "list every address at this postcode" lookup found results — drives the "N addresses found" banner. */
  foundAtPostcode: { postcode: string; count: number } | null;
  /** False when neither OS Places nor getAddress.io is configured server-side. */
  providerConfigured: boolean;
};

async function fetchAllSuggestions(query: string): Promise<FetchAllResult> {
  const q = query.trim();
  if (q.length < 2) {
    return { suggestions: [], foundAtPostcode: null, providerConfigured: true };
  }
  const seen = new Set<string>();
  const out: Suggestion[] = [];
  let providerConfigured = false;
  let providerChecked = false;
  let foundAtPostcode: FetchAllResult["foundAtPostcode"] = null;

  const push = (s: Suggestion) => {
    const k = `${s.source}:${s.label.toLowerCase()}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push(s);
  };

  // 1) Full list at postcode (house / street lines)
  if (shouldTryPostcodeFind(q)) {
    try {
      const { addresses, providerConfigured: pc } = await fetchAddressFindByPostcode(q);
      providerChecked = true;
      providerConfigured = providerConfigured || pc;
      const postcode = normalizePostcodeLike(q);
      if (addresses.length > 0) {
        foundAtPostcode = { postcode, count: addresses.length };
        for (const line of addresses) {
          const label = line.trim();
          if (label) push({ id: null, label, source: "find" });
        }
      }
    } catch {
      providerConfigured = false;
    }
  }

  // 2) Typeahead (partial address, place, or postcode)
  try {
    const { suggestions: rows, providerConfigured: pc } = await fetchAddressAutocomplete(q);
    providerChecked = true;
    providerConfigured = providerConfigured || pc;
    for (const r of rows) {
      push({ id: r.id, label: r.address, source: "autocomplete" });
    }
  } catch {
    providerConfigured = false;
  }

  // 3) Postcode fragment fallback (postcodes.io, no key needed) when nothing else matched
  if (out.length === 0) {
    const fallback = await fetchPostcodeOnlySuggestions(q);
    return {
      suggestions: fallback,
      foundAtPostcode: null,
      providerConfigured: providerChecked ? providerConfigured : true,
    };
  }

  // If we only have find lines, return them (full addresses for the postcode)
  const hasFind = out.some((s) => s.source === "find");
  const suggestions = hasFind
    ? out.filter((s) => s.source === "find" || s.source === "autocomplete")
    : out;

  return { suggestions, foundAtPostcode, providerConfigured };
}

export type AddressFinderValue = {
  /** Canonical UK postcode for APIs and search. */
  postcode: string;
  /** Full line when user picked a resolved UK address (OS Places). */
  formattedAddress: string | null;
};

export type AddressFinderInputProps = {
  label: string;
  value: AddressFinderValue;
  onChange: (next: AddressFinderValue) => void;
  placeholder?: string;
  helpText?: string;
  inputId?: string;
  autoComplete?: string;
  disabled?: boolean;
};

export function AddressFinderInput({
  label,
  value,
  onChange,
  placeholder,
  helpText,
  inputId,
  autoComplete,
  disabled,
}: AddressFinderInputProps) {
  const reactId = useId();
  const id = inputId ?? `address-finder-${reactId}`;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [foundAtPostcode, setFoundAtPostcode] = useState<{ postcode: string; count: number } | null>(
    null,
  );
  const [providerConfigured, setProviderConfigured] = useState(true);
  const [searched, setSearched] = useState(false);
  const [query, setQuery] = useState(() =>
    value.formattedAddress?.trim() || value.postcode.trim() || "",
  );
  const debouncedQuery = useDebouncedValue(query, 200);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputWrapRef = useRef<HTMLDivElement | null>(null);
  const lastFindPostcodeRef = useRef<string | null>(null);
  const [panelRect, setPanelRect] = useState<{ top: number; left: number; width: number } | null>(
    null,
  );
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePanelRect = useCallback(() => {
    const el = inputWrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPanelRect({
      top: rect.bottom + 8,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPanelRect(null);
      return;
    }
    updatePanelRect();
    window.addEventListener("resize", updatePanelRect);
    window.addEventListener("scroll", updatePanelRect, true);
    return () => {
      window.removeEventListener("resize", updatePanelRect);
      window.removeEventListener("scroll", updatePanelRect, true);
    };
  }, [open, updatePanelRect, debouncedQuery, suggestions.length, searched, busy]);

  useEffect(() => {
    const display = value.formattedAddress?.trim() || value.postcode.trim();
    setQuery(display);
  }, [value.postcode, value.formattedAddress]);

  useEffect(() => {
    let cancelled = false;
    const q = debouncedQuery.trim();
    if (!open) return;
    if (q.length < 2) {
      setSuggestions([]);
      setFoundAtPostcode(null);
      setSearched(false);
      return;
    }
    setBusy(true);
    void fetchAllSuggestions(q)
      .then((result) => {
        if (cancelled) return;
        setSuggestions(result.suggestions);
        setFoundAtPostcode(result.foundAtPostcode);
        setProviderConfigured(result.providerConfigured);
        lastFindPostcodeRef.current = result.foundAtPostcode?.postcode ?? null;
        setSearched(true);
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, open]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const root = rootRef.current;
      if (!root) return;
      if (e.target instanceof Node && root.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const commitFromQuery = useCallback(
    (raw: string) => {
      const pc = normalizePostcodeLike(raw);
      onChange({ postcode: pc, formattedAddress: null });
    },
    [onChange],
  );

  const normalizedPostcode = useMemo(
    () => normalizePostcodeLike(value.postcode),
    [value.postcode],
  );

  const showClear = normalizedPostcode.length > 0 || (value.formattedAddress?.trim() ?? "").length > 0;

  const applyFindLine = useCallback(
    (line: string) => {
      const pc =
        lastFindPostcodeRef.current ??
        (shouldTryPostcodeFind(query) ? normalizePostcodeLike(query) : normalizedPostcode);
      const lineTrim = line.trim();
      const formatted = `${lineTrim}, ${pc}`;
      setQuery(formatted);
      onChange({ postcode: pc, formattedAddress: formatted });
    },
    [normalizedPostcode, onChange, query],
  );

  return (
    <div ref={rootRef} className="relative">
      <label
        htmlFor={id}
        className="block text-xs font-semibold uppercase tracking-wide text-neutral-500"
      >
        {label}
      </label>
      <div ref={inputWrapRef} className="relative mt-1.5">
        <MapPin
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
          aria-hidden
        />
        <input
          id={id}
          type="text"
          autoComplete={autoComplete ?? "street-address"}
          value={query}
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            const next = e.target.value;
            setQuery(next);
            commitFromQuery(next);
            setOpen(true);
          }}
          placeholder={placeholder ?? "Postcode or address"}
          className="w-full rounded-lg border border-neutral-200 py-2 pl-9 pr-10 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-neutral-50 disabled:text-neutral-500"
        />
        {busy || resolving ? (
          <Loader2
            className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-neutral-400"
            aria-hidden
          />
        ) : showClear ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              onChange({ postcode: "", formattedAddress: null });
              lastFindPostcodeRef.current = null;
              setSuggestions([]);
              setFoundAtPostcode(null);
              setSearched(false);
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

      {mounted && panelRect && open && suggestions.length > 0
        ? createPortal(
            <div
              className="fixed z-[200] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg"
              style={{
                top: panelRect.top,
                left: panelRect.left,
                width: panelRect.width,
              }}
            >
              {foundAtPostcode ? (
                <p className="border-b border-neutral-100 bg-neutral-50 px-3 py-2 text-xs font-medium text-neutral-600">
                  {foundAtPostcode.count} address{foundAtPostcode.count === 1 ? "" : "es"} at{" "}
                  {foundAtPostcode.postcode}
                </p>
              ) : null}
              <ul className="max-h-72 overflow-y-auto py-1" role="listbox">
                {suggestions.map((s, idx) => (
                  <li key={s.id ? `${s.id}-${idx}` : `${s.source}-${s.label}-${idx}`}>
                    <button
                      type="button"
                      className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left text-sm text-neutral-900 hover:bg-neutral-50"
                      onClick={() => {
                        setOpen(false);
                        if (s.source === "find") {
                          applyFindLine(s.label);
                          return;
                        }
                        if (s.id) {
                          setResolving(true);
                          void fetchAddressResolve(s.id)
                            .then((r) => {
                              const line = r.formatted_line.trim();
                              setQuery(line);
                              onChange({
                                postcode: normalizePostcodeLike(r.postcode),
                                formattedAddress: line,
                              });
                            })
                            .catch(() => {
                              commitFromQuery(s.label);
                              setQuery(s.label);
                            })
                            .finally(() => setResolving(false));
                        } else {
                          const pc = normalizePostcodeLike(s.label);
                          setQuery(pc);
                          onChange({ postcode: pc, formattedAddress: null });
                        }
                      }}
                    >
                      <span className="min-w-0 flex-1 whitespace-normal break-words">{s.label}</span>
                      <span className="shrink-0 pt-0.5 text-xs text-neutral-400">Select</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>,
            document.body,
          )
        : null}

      {mounted && panelRect && open && !busy && searched && debouncedQuery.trim().length >= 2 && suggestions.length === 0
        ? createPortal(
            <div
              className="fixed z-[200] rounded-xl border border-neutral-200 bg-white p-3 shadow-lg"
              style={{
                top: panelRect.top,
                left: panelRect.left,
                width: panelRect.width,
              }}
            >
              {providerConfigured ? (
                <p className="text-sm text-neutral-600">
                  No addresses found for “{debouncedQuery.trim()}”.
                </p>
              ) : (
                <p className="text-sm text-neutral-600">
                  Address lookup is unavailable. Enter your postcode manually.
                </p>
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
