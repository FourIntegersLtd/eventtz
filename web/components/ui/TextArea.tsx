"use client";

import { forwardRef, useId, type TextareaHTMLAttributes } from "react";

export type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string;
  hint?: string;
};

/** Canvas text area: `ez-field` with an `ez-label`, an `ez-input ez-input--area`, then the help or error line. */
export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, error, hint, id, className = "", rows = 4, ...rest },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <div className="ez-field">
      <label htmlFor={inputId} className="ez-label">
        {label}
      </label>
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        className={`ez-input ez-input--area${error ? " ez-input--error" : ""} ${className}`.trim()}
        {...rest}
      />
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
