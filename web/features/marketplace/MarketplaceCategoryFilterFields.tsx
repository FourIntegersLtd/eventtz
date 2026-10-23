"use client";

import Link from "next/link";
import { SERVICE_OPTIONS, VENDOR_WAITLIST_URL } from "@/lib/vendorOnboarding/constants";

const OTHER_TOOLTIP =
  "We're expanding categories. Join the waitlist to hear when your vendor type goes live";

const BROWSE_CATEGORY_OPTIONS = SERVICE_OPTIONS.filter((opt) => opt.value !== "other");

export function categoryChipLabel(types: string[]): string {
  if (types.length === 0) return "Category";
  const first =
    SERVICE_OPTIONS.find((o) => o.value === types[0])?.label ?? types[0] ?? "Category";
  if (types.length === 1) return first;
  return `${first} +${types.length - 1}`;
}

type MarketplaceCategoryFilterFieldsProps = {
  types: string[];
  onToggleType: (value: string) => void;
  /** Landing hero only — browse filters omit “Other” / waitlist. */
  showOtherOption?: boolean;
};

export function MarketplaceCategoryFilterFields({
  types,
  onToggleType,
  showOtherOption = false,
}: MarketplaceCategoryFilterFieldsProps) {
  const options = showOtherOption ? SERVICE_OPTIONS : BROWSE_CATEGORY_OPTIONS;

  return (
    <div className="space-y-1">
      {options.map((opt) =>
        opt.value === "other" ? (
          <div
            key={opt.value}
            className="flex items-center justify-between gap-2 rounded-lg px-2 py-2"
          >
            <span className="text-sm text-ink-2" title={OTHER_TOOLTIP}>
              Other
            </span>
            <Link
              href={VENDOR_WAITLIST_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-primary hover:underline"
            >
              Waitlist
            </Link>
          </div>
        ) : (
          <label
            key={opt.value}
            className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-2 hover:bg-surface-3"
          >
            <input
              type="checkbox"
              checked={types.includes(opt.value)}
              onChange={() => onToggleType(opt.value)}
              className="mt-0.5 rounded border-line-strong text-primary focus:ring-primary"
            />
            <span className="flex flex-col">
              <span className="text-sm text-ink">{opt.label}</span>
              {opt.examples ? (
                <span className="text-xs text-ink-3">e.g. {opt.examples}</span>
              ) : null}
            </span>
          </label>
        ),
      )}
    </div>
  );
}
