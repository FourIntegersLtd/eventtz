"use client";

import { Minus, Plus } from "lucide-react";
import { FOCUS_RING } from "@/components/ui/tokens";

type QuantityStepperProps = {
  value: number;
  /** Inclusive minimum when selected. 0 is allowed as “not selected”. */
  min?: number;
  max?: number | null;
  onChange: (next: number) => void;
  "aria-label": string;
  disabled?: boolean;
  /** When false, quantity cannot drop below `min` (no “unselected” zero). */
  allowZero?: boolean;
  className?: string;
};

/**
 * Compact +/- stepper. From 0, plus jumps to `min` (default 1). From `min`, minus
 * returns to 0 so callers can treat 0 as unselected, unless `allowZero` is false.
 */
export function QuantityStepper({
  value,
  min = 1,
  max = null,
  onChange,
  disabled = false,
  allowZero = true,
  className = "",
  ...aria
}: QuantityStepperProps) {
  const canDecrement = !disabled && value > (allowZero ? 0 : min);
  const canIncrement =
    !disabled && (value <= 0 || max == null || value < max);

  return (
    <div
      className={`inline-flex h-9 items-center rounded-lg border border-neutral-200 bg-white ${className}`.trim()}
      role="group"
      aria-label={aria["aria-label"]}
    >
      <button
        type="button"
        disabled={!canDecrement}
        aria-label="Decrease quantity"
        onClick={() => {
          if (value <= (allowZero ? 0 : min)) return;
          if (allowZero && value <= min) {
            onChange(0);
            return;
          }
          onChange(value - 1);
        }}
        className={`inline-flex h-9 w-9 items-center justify-center rounded-l-lg text-neutral-700 transition enabled:hover:bg-neutral-50 disabled:text-neutral-300 ${FOCUS_RING}`}
      >
        <Minus className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
      </button>
      <span className="min-w-[2.25rem] px-1 text-center text-sm font-semibold tabular-nums text-neutral-900">
        {value}
      </span>
      <button
        type="button"
        disabled={!canIncrement}
        aria-label="Increase quantity"
        onClick={() => {
          if (value <= 0) {
            onChange(min);
            return;
          }
          if (max != null && value >= max) return;
          onChange(value + 1);
        }}
        className={`inline-flex h-9 w-9 items-center justify-center rounded-r-lg text-neutral-700 transition enabled:hover:bg-neutral-50 disabled:text-neutral-300 ${FOCUS_RING}`}
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
      </button>
    </div>
  );
}
