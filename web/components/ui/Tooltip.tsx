"use client";

import type { ReactNode } from "react";

type TooltipProps = {
  /** Short plain-English explanation. Keep it to a sentence or two. */
  hint: ReactNode;
  children: ReactNode;
  /** Which side of the trigger the bubble sits on. */
  placement?: "top" | "bottom";
  /** Override when the default bubble is too narrow for the copy. */
  widthClassName?: string;
  className?: string;
};

/**
 * Hover/focus hint bubble. Shows on keyboard focus too, so the explanation is
 * reachable without a mouse - and it wraps the trigger rather than living inside
 * it, so it still appears for disabled buttons.
 */
export function Tooltip({
  hint,
  children,
  placement = "top",
  widthClassName = "w-52",
  className = "",
}: TooltipProps) {
  const bubblePosition =
    placement === "top" ? "bottom-[calc(100%+6px)]" : "top-[calc(100%+6px)]";
  const arrowPosition =
    placement === "top"
      ? "top-full border-t-ink"
      : "bottom-full border-b-ink";

  return (
    <div className={`group relative ${className}`.trim()}>
      {children}
      <div
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 z-30 hidden -translate-x-1/2 rounded-lg bg-ink px-2.5 py-2 text-[11px] leading-snug text-white shadow-overlay group-hover:block group-focus-within:block ${bubblePosition} ${widthClassName}`}
      >
        {hint}
        <span
          className={`absolute left-1/2 -translate-x-1/2 border-4 border-transparent ${arrowPosition}`}
        />
      </div>
    </div>
  );
}
