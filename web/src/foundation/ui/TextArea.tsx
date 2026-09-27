"use client";

/** Labelled multiline field with an error or a hint. */

import { forwardRef, useId, type TextareaHTMLAttributes } from "react";
import { FORM_CONTROL, FORM_CONTROL_FOCUS, FOCUS_RING } from "@/foundation/ui/tokens";

/** Labelled textarea. Remaining props are passed to the element. */
export type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string;
  hint?: string;
};

/** Labelled multiline field with an error or a hint under it. */
export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, error, hint, id, className = "", rows = 4, ...rest },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium text-neutral-800">
        {label}
      </label>
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        className={`${FORM_CONTROL} ${FORM_CONTROL_FOCUS} resize-none ${FOCUS_RING} ${
          error ? "border-red-300" : ""
        } ${className}`.trim()}
        {...rest}
      />
      {error ? (
        <p id={`${inputId}-error`} className="text-xs font-medium text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-xs text-neutral-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
