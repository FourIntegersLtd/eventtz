import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { X } from "lucide-react";

export function labelClass() {
  return "block text-sm font-medium text-neutral-700 mb-1.5";
}

export function inputClass() {
  return "w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none ring-primary/20 focus:border-primary focus:ring-2";
}

const clearButtonClass =
  "absolute right-2 inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700";

type ClearableTextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
};

export function ClearableTextField({
  value,
  onChange,
  className,
  ...props
}: ClearableTextFieldProps) {
  return (
    <div className="relative">
      <input
        {...props}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass()} ${value ? "pr-10" : ""} ${className ?? ""}`}
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear"
          onClick={() => onChange("")}
          className={`${clearButtonClass} top-1/2 -translate-y-1/2`}
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      ) : null}
    </div>
  );
}

type ClearableTextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
};

export function ClearableTextarea({
  value,
  onChange,
  className,
  ...props
}: ClearableTextareaProps) {
  return (
    <div className="relative">
      <textarea
        {...props}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass()} ${value ? "pr-10" : ""} ${className ?? ""}`}
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear"
          onClick={() => onChange("")}
          className={`${clearButtonClass} top-2.5`}
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      ) : null}
    </div>
  );
}

export function ToggleChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm transition ${
        active
          ? "border-primary bg-primary/10 font-medium text-primary"
          : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300"
      }`}
    >
      {children}
    </button>
  );
}
