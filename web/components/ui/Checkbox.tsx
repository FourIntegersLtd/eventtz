"use client";

import { useId, type ReactNode } from "react";

export type CheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** The text beside the box. */
  children: ReactNode;
  disabled?: boolean;
  /** Blocks form submission until ticked (e.g. agreeing to terms). */
  required?: boolean;
  className?: string;
};

/** Canvas checkbox row (`ez-check`): the box with its text label; `onChange` gets the new checked value. */
export function Checkbox({ checked, onChange, children, disabled, required, className }: CheckboxProps) {
  const id = useId();
  return (
    <label className={`ez-check${className ? ` ${className}` : ""}`} htmlFor={id}>
      <input
        type="checkbox"
        id={id}
        checked={checked}
        disabled={disabled}
        required={required}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{children}</span>
    </label>
  );
}
