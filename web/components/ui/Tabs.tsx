"use client";

import { FOCUS_RING } from "@/components/ui/tokens";

export type TabOption<T extends string> = {
  value: T;
  label: string;
  /** Optional count shown beside the label; hidden when zero or absent. */
  count?: number;
};

export type TabsProps<T extends string> = {
  options: readonly TabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  "aria-label": string;
};

/** Underline tab bar (controlled). Use SegmentedControl for compact filter rows instead. */
export function Tabs<T extends string>({
  options,
  value,
  onChange,
  className = "",
  ...aria
}: TabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={aria["aria-label"]}
      className={`flex max-w-full gap-6 overflow-x-auto border-b border-line ${className}`.trim()}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={`-mb-px inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-0.5 text-sm font-medium transition duration-150 ease-out ${FOCUS_RING} ${
              active
                ? "border-primary text-primary"
                : "border-transparent text-ink-3 hover:text-ink"
            }`}
          >
            {option.label}
            {option.count != null && option.count > 0 ? (
              <span
                className={`min-w-[1.25rem] rounded-full px-1.5 py-0.5 text-center text-xs font-medium ${
                  active ? "bg-primary-soft text-primary" : "bg-surface-3 text-ink-2"
                }`}
              >
                {option.count > 99 ? "99+" : option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
