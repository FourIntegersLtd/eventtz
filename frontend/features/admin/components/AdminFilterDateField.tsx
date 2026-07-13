"use client";

import { DateInput } from "@/components/ui/DateInput";

type AdminFilterDateFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
  className?: string;
};

export function AdminFilterDateField({
  label,
  value,
  onChange,
  optional = true,
  className = "",
}: AdminFilterDateFieldProps) {
  return (
    <label
      className={`grid min-w-0 max-w-full grid-cols-1 overflow-hidden text-sm lg:w-auto lg:min-w-[9rem] ${className}`.trim()}
    >
      <span className="text-neutral-600">
        {label}
        {optional ? <span className="text-neutral-400"> · optional</span> : null}
      </span>
      <DateInput
        value={value}
        onChange={(e) => onChange(e.target.value)}
        shellClassName="mt-1"
        className="focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
    </label>
  );
}
