"use client";

import {
  VENDOR_SERVICE_OPTIONS,
} from "./vendorServiceOptions";

export function categoryChipLabel(types: string[]): string {
  if (types.length === 0) return "Category";
  const first =
    VENDOR_SERVICE_OPTIONS.find((option) => option.value === types[0])?.label ?? types[0] ?? "Category";
  if (types.length === 1) return first;
  return `${first} +${types.length - 1}`;
}

type MarketplaceCategoryFilterFieldsProps = {
  types: string[];
  onToggleType: (value: string) => void;
};

/** Checkbox list of vendor service categories for the filters drawer. */
export function MarketplaceCategoryFilterFields({
  types,
  onToggleType,
}: MarketplaceCategoryFilterFieldsProps) {
  return (
    <div className="space-y-1">
      {VENDOR_SERVICE_OPTIONS.map((option) => (
        <label
          key={option.value}
          className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 hover:bg-neutral-50"
        >
          <input
            type="checkbox"
            checked={types.includes(option.value)}
            onChange={() => onToggleType(option.value)}
            className="rounded border-neutral-300 text-primary focus:ring-primary"
          />
          <span className="text-sm text-neutral-800">{option.label}</span>
        </label>
      ))}
    </div>
  );
}
