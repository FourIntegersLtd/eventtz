"use client";

import { DateInput } from "@/components/ui/DateInput";

type EzFilterDateFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
  className?: string;
};

/** Labelled date input for a filter modal, with an "optional" hint; an empty value clears the filter. */
export function EzFilterDateField({
  label,
  value,
  onChange,
  optional = true,
  className = "",
}: EzFilterDateFieldProps) {
  return (
    <label
      className={`grid w-full min-w-0 max-w-full grid-cols-1 text-sm lg:w-auto lg:min-w-[12.5rem] ${className}`.trim()}
    >
      <span className="text-neutral-600">
        {label}
        {optional ? <span className="text-neutral-400"> · optional</span> : null}
      </span>
      <DateInput
        allowEmpty
        value={value}
        onChange={(e) => onChange(e.target.value)}
        shellClassName="mt-1"
      />
    </label>
  );
}
