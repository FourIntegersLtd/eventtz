import type { ButtonHTMLAttributes } from "react";
import { FOCUS_RING } from "@/components/ui/tokens";

export type ChipProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  /** Selected state for filter or toggle chips. */
  active?: boolean;
};

/** Pill toggle used for filters; active chips take the brand tint. */
export function Chip({ active = false, className = "", children, ...rest }: ChipProps) {
  const stateClasses = active
    ? "border-primary-border bg-primary-soft text-primary"
    : "border-line-strong bg-white text-ink-2 hover:bg-surface-3";
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition duration-150 ease-out disabled:opacity-50 ${FOCUS_RING} ${stateClasses} ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
}
