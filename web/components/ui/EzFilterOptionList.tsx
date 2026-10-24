"use client";

import { Check } from "lucide-react";
import type { EzFilterOption } from "@/components/ui/ezFilterTypes";

type EzFilterOptionListProps<T extends string> = {
  options: readonly EzFilterOption<T>[];
  value: T;
  onChange: (id: T) => void;
  listAriaLabel: string;
  /** When set, picking an option calls this instead of onChange only. */
  onPick?: (id: T) => void;
};

/** Single-choice filter list (used inside modals). */
export function EzFilterOptionList<T extends string>({
  options,
  value,
  onChange,
  listAriaLabel,
  onPick,
}: EzFilterOptionListProps<T>) {
  const pick = (id: T) => {
    onChange(id);
    onPick?.(id);
  };

  return (
    <ul
      className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white"
      role="listbox"
      aria-label={listAriaLabel}
    >
      {options.map((option) => {
        const selected = value === option.id;
        return (
          <li key={option.id} role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={selected}
              className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition ${
                selected ? "bg-primary/[0.04]" : "hover:bg-surface-3"
              }`}
              onClick={() => pick(option.id)}
            >
              <span
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-primary"
                aria-hidden
              >
                {selected ? <Check className="h-4 w-4" strokeWidth={2.5} /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-ink">{option.title}</span>
                {option.subtitle ? (
                  <span className="mt-0.5 block text-xs leading-snug text-ink-3">
                    {option.subtitle}
                  </span>
                ) : null}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
