"use client";

import type { ReactNode } from "react";
import { ListFilter } from "lucide-react";
import { TextField } from "@/components/ui/TextField";

type EzListFilterToolbarProps = {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchAriaLabel?: string;
  /** DOM id for the search input, for a screen that needs a stable hook (tests, labels). */
  searchId?: string;
  inputClassName?: string;
  searchMaxWidth?: string;
  /** Opens the single list-filter modal. */
  onOpenFilter?: () => void;
  /** How many filter dimensions are active (badge on the Filter button). */
  activeFilterCount?: number;
  summary?: { label: string; onClear: () => void } | null;
  trailing?: ReactNode;
};

/**
 * Search on the left, one Filter control on the right; optional active-filter summary below. Every part
 * is optional, so any list can use just the search, just the filter button, or both.
 */
export function EzListFilterToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  searchAriaLabel,
  searchId,
  inputClassName,
  searchMaxWidth = "22rem",
  onOpenFilter,
  activeFilterCount = 0,
  summary,
  trailing,
}: EzListFilterToolbarProps) {
  const showSearch = onSearchChange !== undefined && searchValue !== undefined;
  const filterCount = Math.max(0, activeFilterCount);

  return (
    <div className="ez-stack ez-stack--sm">
      <div
        className={`ez-hrow flex-wrap gap-3 ${showSearch ? "ez-between" : "justify-start"}`}
      >
        {showSearch ? (
          <div className="min-w-0 flex-1" style={{ maxWidth: searchMaxWidth }}>
            <TextField
              id={searchId}
              type="search"
              label={searchAriaLabel ?? searchPlaceholder ?? "Search"}
              hideLabel
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              onClear={() => onSearchChange("")}
              className={inputClassName}
              placeholder={searchPlaceholder ?? "Search"}
              clearLabel="Clear search"
            />
          </div>
        ) : null}
        {onOpenFilter || trailing ? (
        <div className="ez-hrow shrink-0 flex-wrap gap-2">
          {onOpenFilter ? (
            <button
              type="button"
              className="ez-btn ez-btn--secondary shrink-0"
              onClick={onOpenFilter}
              aria-haspopup="dialog"
            >
              <ListFilter size={18} strokeWidth={1.75} aria-hidden />
              Filter
              {filterCount > 0 ? (
                <span className="ez-badge ez-badge--brand ml-1.5 px-1.5 py-0 text-[10px]">
                  {filterCount > 9 ? "9+" : filterCount}
                </span>
              ) : null}
            </button>
          ) : null}
          {trailing}
        </div>
        ) : null}
      </div>
      {summary ? (
        <p className="ez-small text-ink-2">
          Showing: <span className="font-medium text-neutral-800">{summary.label}</span>
          <button
            type="button"
            className="ml-2 font-medium text-primary underline decoration-primary/40 underline-offset-2"
            onClick={summary.onClear}
          >
            Clear
          </button>
        </p>
      ) : null}
    </div>
  );
}
