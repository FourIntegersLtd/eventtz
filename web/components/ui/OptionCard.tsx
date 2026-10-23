"use client";

import { useId, type ReactNode } from "react";

export type OptionCardProps = {
  type: "checkbox" | "radio";
  name?: string;
  checked: boolean;
  onChange: () => void;
  title: ReactNode;
  description?: ReactNode;
};

/**
 * Canvas option card (`ez-option`): a checkbox or radio with a bold title and optional
 * description. `ez-option--active` marks the chosen one.
 */
export function OptionCard({ type, name, checked, onChange, title, description }: OptionCardProps) {
  const id = useId();
  return (
    <label className={`ez-option${checked ? " ez-option--active" : ""}`} htmlFor={id}>
      <input type={type} id={id} name={name} checked={checked} onChange={onChange} />
      <span className="ez-stack ez-stack--sm" style={{ flex: 1, minWidth: 0 }}>
        <span className="ez-strong">{title}</span>
        {description ? <span className="ez-small">{description}</span> : null}
      </span>
    </label>
  );
}
