import { clsx } from "clsx";
import type { ButtonHTMLAttributes } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
  loading?: boolean;
}

/** A primary or secondary button, with a busy state for in-flight submits. */
export function Button({ variant = "primary", loading = false, className, disabled, children, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading}
      className={clsx(
        "inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary" && "bg-primary text-white hover:opacity-90",
        variant === "secondary" && "bg-primary-soft text-primary hover:bg-primary-muted",
        className,
      )}
    >
      {children}
    </button>
  );
}
