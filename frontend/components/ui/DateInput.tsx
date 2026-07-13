"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { FOCUS_RING, RADIUS } from "@/components/ui/tokens";

export type DateInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  shellClassName?: string;
};

/**
 * Native date input with Safari iOS width containment (see `.date-input-shell` in globals.css).
 */
export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(function DateInput(
  { className = "", shellClassName = "", ...rest },
  ref,
) {
  return (
    <div className={`date-input-shell ${shellClassName}`.trim()}>
      <input
        ref={ref}
        type="date"
        className={`box-border block h-11 w-full min-w-0 max-w-full rounded-lg border border-neutral-200 bg-white px-2 py-2 text-sm text-neutral-900 [color-scheme:light] sm:px-3 ${FOCUS_RING} ${RADIUS.sm} ${className}`.trim()}
        {...rest}
      />
    </div>
  );
});
