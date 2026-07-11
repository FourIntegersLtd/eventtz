"use client";

import { useRef } from "react";
import { FOCUS_RING, RADIUS } from "@/components/ui/tokens";

export type SegmentedControlOption<T extends string> = {
  value: T;
  label: string;
  /** Optional count shown next to the label, e.g. pending request count. */
  count?: number;
};

export type SegmentedControlProps<T extends string> = {
  options: readonly SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  "aria-label": string;
};

/**
 * A single flat filter row — replaces nested tab-in-tab patterns (e.g. a
 * top-level Bookings/Disputes tab stacked with an inner Active/Completed/
 * Closed tab). Full arrow-key operability per the craft bar.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = "",
  ...aria
}: SegmentedControlProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const currentIndex = options.findIndex((o) => o.value === value);
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const delta = e.key === "ArrowRight" ? 1 : -1;
      const nextIndex = (currentIndex + delta + options.length) % options.length;
      onChange(options[nextIndex].value);
      const buttons = containerRef.current?.querySelectorAll<HTMLButtonElement>("button");
      buttons?.[nextIndex]?.focus();
    }
  };

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label={aria["aria-label"]}
      onKeyDown={onKeyDown}
      className={`inline-flex max-w-full flex-wrap items-center gap-1 overflow-x-auto border border-neutral-200 bg-neutral-100 p-1 ${RADIUS.md} ${className}`.trim()}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium transition duration-150 ease-out min-h-11 ${FOCUS_RING} ${
              active
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            <span className="truncate">{option.label}</span>
            {option.count != null && option.count > 0 ? (
              <span
                className={`min-w-[1.25rem] rounded-full px-1.5 py-0.5 text-center text-xs font-bold ${
                  active ? "bg-primary text-white" : "bg-neutral-200 text-neutral-700"
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
