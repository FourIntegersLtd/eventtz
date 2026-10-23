"use client";

import { useId, type ReactNode } from "react";

/** Props shared by the Eventtz design-system text controls. */
export type EzTextFieldProps = {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  /** Helper line under the control; replaced by `error` when one is set. */
  help?: ReactNode;
  error?: string | null;
  type?: string;
  placeholder?: string;
  readOnly?: boolean;
  autoComplete?: string;
  onBlur?: () => void;
  /** Render a textarea (`ez-input--area`) instead of a single-line input. */
  multiline?: boolean;
  maxLength?: number;
  min?: number;
  inputMode?: "numeric" | "decimal" | "text" | "tel";
  /** Extra inline style on the control, e.g. a fixed width. */
  controlStyle?: React.CSSProperties;
};

/** A labelled `ez-field`: label, input or textarea, then the help or error line. */
export function EzTextField({
  label,
  value,
  onChange,
  help,
  error,
  type = "text",
  placeholder = "",
  readOnly,
  autoComplete,
  onBlur,
  multiline,
  maxLength,
  min,
  inputMode,
  controlStyle,
}: EzTextFieldProps) {
  const id = useId();
  const describedBy = error || help ? `${id}-note` : undefined;
  const className = `ez-input${multiline ? " ez-input--area" : ""}${error ? " ez-input--error" : ""}`;
  return (
    <div className="ez-field">
      <label className="ez-label" htmlFor={id}>
        {label}
      </label>
      {multiline ? (
        <textarea
          className={className}
          id={id}
          value={value}
          placeholder={placeholder}
          readOnly={readOnly}
          maxLength={maxLength}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          style={controlStyle}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
        />
      ) : (
        <input
          className={className}
          id={id}
          type={type}
          value={value}
          placeholder={placeholder}
          readOnly={readOnly}
          autoComplete={autoComplete}
          maxLength={maxLength}
          min={min}
          inputMode={inputMode}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          style={controlStyle}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
        />
      )}
      {error ? (
        <span className="ez-error-text" id={`${id}-note`} role="alert">
          {error}
        </span>
      ) : help ? (
        <span className="ez-help" id={`${id}-note`}>
          {help}
        </span>
      ) : null}
    </div>
  );
}

/** An `ez-check` row: checkbox with a text label. */
export function EzCheck({
  checked,
  onChange,
  children,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <label className={`ez-check${className ? ` ${className}` : ""}`} htmlFor={id}>
      <input
        type="checkbox"
        id={id}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{children}</span>
    </label>
  );
}

/** An `ez-chip` toggle button (`ez-chip--active` when selected). */
export function EzChip({
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
      className={`ez-chip${active ? " ez-chip--active" : ""}`}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/**
 * An `ez-option` card holding a checkbox or radio with a bold title and optional
 * description; `ez-option--active` marks the chosen one.
 */
export function EzOption({
  type,
  name,
  checked,
  onChange,
  title,
  description,
}: {
  type: "checkbox" | "radio";
  name?: string;
  checked: boolean;
  onChange: () => void;
  title: ReactNode;
  description?: ReactNode;
}) {
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
