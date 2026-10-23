"use client";

import { X } from "lucide-react";
import { forwardRef, useId, type CSSProperties, type InputHTMLAttributes } from "react";
import { DateInput } from "@/components/ui/DateInput";

export type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
  /** When `type="date"`, start blank until the user picks (optional end dates, filters). */
  allowEmpty?: boolean;
  /** Keep the label for screen readers only (search boxes that carry a placeholder). */
  hideLabel?: boolean;
  /** Show a clear button while the field has a value; called when it is pressed. */
  onClear?: () => void;
  clearLabel?: string;
  /** Inline style on the outer `ez-field`, e.g. a fixed width. */
  wrapperStyle?: CSSProperties;
};

/** Canvas text field: `ez-field` with an `ez-label`, an `ez-input`, then the help or error line. */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  {
    label,
    error,
    hint,
    id,
    className = "",
    type,
    allowEmpty,
    hideLabel = false,
    onClear,
    clearLabel = "Clear search",
    wrapperStyle,
    ...rest
  },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const inputClassName = `ez-input${error ? " ez-input--error" : ""} ${className}`.trim();
  const hasValue = typeof rest.value === "string" ? rest.value.length > 0 : false;
  const showClear = Boolean(onClear) && hasValue;

  const input = (
    <input
      ref={ref}
      id={inputId}
      type={type}
      aria-invalid={Boolean(error)}
      aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
      className={inputClassName}
      {...rest}
    />
  );

  return (
    <div className="ez-field" style={wrapperStyle}>
      <label htmlFor={inputId} className={`ez-label${hideLabel ? " sr-only" : ""}`}>
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
      ) : onClear ? (
        <div className={`ez-clearable-input${showClear ? " ez-clearable-input--has-value" : ""}`}>
          {input}
          {showClear ? (
            <button type="button" className="ez-clearable-input__clear" aria-label={clearLabel} onClick={onClear}>
              <X strokeWidth={1.75} aria-hidden />
            </button>
          ) : null}
        </div>
      ) : (
        input
      )}
      {error ? (
        <span id={`${inputId}-error`} className="ez-error-text" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span id={`${inputId}-hint`} className="ez-help">
          {hint}
        </span>
      ) : null}
    </div>
  );
});
