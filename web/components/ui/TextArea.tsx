"use client";

import { X } from "lucide-react";
import { forwardRef, useId, type ReactNode, type TextareaHTMLAttributes } from "react";

export type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: ReactNode;
  error?: string | null;
  hint?: string;
  /** Keep the label for screen readers only (the area sits under a visible heading). */
  hideLabel?: boolean;
  /** Show a clear button while the area has a value; called when it is pressed. */
  onClear?: () => void;
  clearLabel?: string;
};

/** Canvas text area: `ez-field` with an `ez-label`, an `ez-input ez-input--area`, then the help or error line. */
export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, error, hint, hideLabel = false, onClear, clearLabel = "Clear", id, className = "", rows = 4, ...rest },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const showClear = Boolean(onClear) && typeof rest.value === "string" && rest.value.length > 0;
  const area = (
    <textarea
      ref={ref}
      id={inputId}
      rows={rows}
      aria-invalid={Boolean(error)}
      aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
      className={`ez-input ez-input--area${error ? " ez-input--error" : ""} ${className}`.trim()}
      {...rest}
    />
  );
  return (
    <div className="ez-field">
      <label htmlFor={inputId} className={`ez-label${hideLabel ? " sr-only" : ""}`}>
        {label}
      </label>
      {onClear ? (
        <div className={`ez-clearable-input ez-clearable-input--area${showClear ? " ez-clearable-input--has-value" : ""}`}>
          {area}
          {showClear ? (
            <button type="button" className="ez-clearable-input__clear" aria-label={clearLabel} onClick={onClear}>
              <X strokeWidth={1.75} aria-hidden />
            </button>
          ) : null}
        </div>
      ) : (
        area
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
