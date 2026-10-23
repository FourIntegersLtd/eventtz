import type { ButtonHTMLAttributes } from "react";

export type ChipProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  /** Selected state for filter or toggle chips. */
  active?: boolean;
};

/** Pill toggle (`ez-chip`) used for filters and choices; active chips take the brand tint. */
export function Chip({ active = false, className = "", children, ...rest }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`ez-chip${active ? " ez-chip--active" : ""} disabled:opacity-50 ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
}
