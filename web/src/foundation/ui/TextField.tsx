import { clsx } from "clsx";
import type { InputHTMLAttributes } from "react";

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

/** A labelled text input with an inline validation message. */
export function TextField({ label, error, id, className, ...rest }: TextFieldProps) {
  const fieldId = id ?? rest.name ?? label.toLowerCase().replace(/\s+/g, "-");
  return (
    <label htmlFor={fieldId} className="block">
      <span className="mb-1 block text-sm font-medium text-neutral-700">{label}</span>
      <input
        id={fieldId}
        {...rest}
        aria-invalid={Boolean(error)}
        className={clsx(
          "w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-primary-border",
          error ? "border-red-400" : "border-primary-border",
          className,
        )}
      />
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : null}
    </label>
  );
}
