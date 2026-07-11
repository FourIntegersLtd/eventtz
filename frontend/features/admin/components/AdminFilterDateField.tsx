"use client";

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
      <div className="date-input-shell mt-1">
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="box-border block h-11 rounded-lg border border-neutral-200 bg-white px-2 py-2 text-sm [color-scheme:light] sm:px-3"
        />
      </div>
    </label>
  );
}
