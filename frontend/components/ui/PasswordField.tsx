"use client";

import { Eye, EyeOff } from "lucide-react";
import { forwardRef, useId, useState, type InputHTMLAttributes } from "react";
import { FOCUS_RING, RADIUS, TOUCH_TARGET } from "@/components/ui/tokens";

export type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  error?: string;
  hint?: string;
};

/** Text field with a show / hide control for passwords. */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(function PasswordField(
  { label, error, hint, id, className = "", ...rest },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);
  const inputClassName = `w-full border py-2 pl-3 pr-11 text-sm text-neutral-900 transition duration-150 ease-out ${RADIUS.sm} ${FOCUS_RING} ${
    error ? "border-red-300" : "border-neutral-200"
  } ${className}`.trim();

  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium text-neutral-800">
        {label}
      </label>
      <div className="relative">
        <input
          {...rest}
          ref={ref}
          id={inputId}
          type={visible ? "text" : "password"}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          className={inputClassName}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className={`absolute inset-y-0 right-0 flex ${TOUCH_TARGET} items-center justify-center text-neutral-500 hover:text-neutral-800`}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
        </button>
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="text-xs font-medium text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-xs text-neutral-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
