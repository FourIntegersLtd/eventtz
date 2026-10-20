"use client";

import { X } from "lucide-react";
import type { CSSProperties, InputHTMLAttributes } from "react";

type EzClearableInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type"
> & {
  value: string;
  onChange: (value: string) => void;
  /** Defaults to `search` for list filters. */
  type?: "search" | "text";
  inputClassName?: string;
  wrapperClassName?: string;
  wrapperStyle?: CSSProperties;
  clearLabel?: string;
};

/**
 * Text/search field with a clear control. Clearing resets the value so parent hooks
 * can refetch server-paginated lists (offset 0, no `q` param).
 */
export function EzClearableInput({
  value,
  onChange,
  type = "search",
  inputClassName = "ez-input",
  wrapperClassName = "",
  wrapperStyle,
  clearLabel = "Clear search",
  className,
  ...inputProps
}: EzClearableInputProps) {
  const hasValue = value.length > 0;
  const wrapperClasses = [
    "ez-clearable-input",
    hasValue ? "ez-clearable-input--has-value" : "",
    wrapperClassName,
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={wrapperClasses} style={wrapperStyle}>
      <input
        {...inputProps}
        type={type}
        className={inputClassName}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {hasValue ? (
        <button
          type="button"
          className="ez-clearable-input__clear"
          aria-label={clearLabel}
          onClick={() => onChange("")}
        >
          <X strokeWidth={1.75} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
