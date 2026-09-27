"use client";

/** Labelled text field, including the date picker when the type is date. */

import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { DateInput } from "@/foundation/ui/DateInput";
import { FORM_CONTROL, FORM_CONTROL_FOCUS, FOCUS_RING } from "@/foundation/ui/tokens";

/** Labelled input. `type="date"` renders the day, month, and year picker. */
export type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
  /** When `type="date"`, start blank until the user picks (optional end dates, filters). */
  allowEmpty?: boolean;
};

/** Labelled text field with an error or a hint under it. */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, hint, id, className = "", type, allowEmpty, ...rest },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const inputClassName = `${FORM_CONTROL} ${FORM_CONTROL_FOCUS} ${FOCUS_RING} ${
    error ? "border-red-300" : ""
  } ${className}`.trim();

  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium text-neutral-800">
        {label}
      </label>
      {type === "date" ? (
        <DateInput
          id={inputId}
          allowEmpty={allowEmpty}
          value={typeof rest.value === "string" ? rest.value : undefined}
          defaultValue={typeof rest.defaultValue === "string" ? rest.defaultValue : undefined}
          min={typeof rest.min === "string" ? rest.min : undefined}
          disabled={rest.disabled}
          onChange={rest.onChange}
          className={className}
        />
      ) : (
        <input
          ref={ref}
          id={inputId}
          type={type}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          className={inputClassName}
          {...rest}
        />
      )}
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
