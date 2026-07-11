"use client";

type AdminFilterDateFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

export function AdminFilterDateField({
  label,
  value,
  onChange,
  className = "",
}: AdminFilterDateFieldProps) {
  return (
    <label
      className={`block w-full text-sm sm:w-auto sm:min-w-[10rem] ${className}`.trim()}
    >
      <span className="text-neutral-600">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full min-w-0 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
      />
    </label>
  );
}
