"use client";

import { useRef } from "react";
import { FOCUS_RING, RADIUS } from "@/components/ui/tokens";

export type SegmentedControlOption<T extends string> = {
  value: T;
  label: string;
  /** Optional count shown next to the label, e.g. pending request count. */
  count?: number;
  disabled?: boolean;
  /** Native title tooltip - useful when an option is disabled. */
  hint?: string;
};

export type SegmentedControlProps<T extends string> = {
  options: readonly SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  /** Each segment grows to fill the row evenly. */
  stretch?: boolean;
  "aria-label": string;
  /**
   * `tabs` (default) renders a tablist for switching views. `radio` renders a
   * radiogroup for choosing one value in a form, with the same arrow keys.
   */
  semantics?: "tabs" | "radio";
};

/**
 * A single flat filter row - replaces nested tab-in-tab patterns (e.g. a
 * top-level Bookings/Disputes tab stacked with an inner Active/Completed/
 * Closed tab). Full arrow-key operability per the craft bar.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = "",
  stretch = false,
  semantics = "tabs",
  ...aria
}: SegmentedControlProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);

  const isRadio = semantics === "radio";

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
      role={isRadio ? "radiogroup" : "tablist"}
      aria-label={aria["aria-label"]}
      onKeyDown={onKeyDown}
      className={`${stretch ? "flex w-full" : "inline-flex max-w-full flex-wrap"} items-center gap-1 overflow-x-auto border border-line bg-surface-3 p-1 ${RADIUS.md} ${className}`.trim()}
    >
      {options.map((option) => {
        const active = option.value === value;
        const disabled = Boolean(option.disabled);
        return (
          <button
            key={option.value}
            type="button"
            role={isRadio ? "radio" : "tab"}
            {...(isRadio ? { "aria-checked": active } : { "aria-selected": active })}
            aria-disabled={disabled}
            title={option.hint}
            tabIndex={active ? 0 : -1}
            disabled={disabled}
            onClick={() => {
              if (!disabled) onChange(option.value);
            }}
            className={`inline-flex items-center justify-center gap-1.5 rounded-control px-3 py-2.5 text-sm font-medium transition duration-150 ease-out min-h-11 ${FOCUS_RING} ${
              stretch ? "min-w-0 flex-1" : ""
            } ${
              disabled
                ? "cursor-not-allowed opacity-45"
                : active
                  ? "bg-white text-ink shadow-xs"
                  : "text-ink-3 hover:text-ink"
            }`}
          >
            <span className="truncate">{option.label}</span>
            {option.count != null && option.count > 0 ? (
              <span
                className={`min-w-[1.25rem] rounded-full px-1.5 py-0.5 text-center text-xs font-semibold ${
                  active ? "bg-primary text-white" : "bg-line text-ink-2"
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
