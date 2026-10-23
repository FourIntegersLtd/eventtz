"use client";

import { ChevronDown } from "lucide-react";
import { forwardRef, useId, type SelectHTMLAttributes } from "react";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
};

/** Canvas select: `ez-field` with an `ez-label` and an `ez-select-wrap` around the `ez-input ez-select`. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, id, className = "", children, ...rest },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <div className="ez-field">
      <label htmlFor={inputId} className="ez-label">
        {label}
      </label>
      <div className="ez-select-wrap">
        <select
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error)}
          className={`ez-input ez-select${error ? " ez-input--error" : ""} ${className}`.trim()}
          {...rest}
        >
          {children}
        </select>
        <ChevronDown aria-hidden />
      </div>
      {error ? (
        <span className="ez-error-text" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
});
