"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import {
  getButtonClassName,
  type ButtonShape,
  type ButtonSize,
  type ButtonVariant,
} from "@/components/ui/buttonStyles";

export type { ButtonShape, ButtonSize, ButtonVariant };

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
  loading?: boolean;
  /** Icon-only or icon+label leading element. */
  icon?: React.ReactNode;
};

/**
 * Base button primitive for the signed-in portal. Every variant carries a
 * press state (active:scale) and, when `loading`, replaces its label with an
 * inline spinner rather than blocking behind a separate overlay — async
 * actions (accept/decline/pay/submit) should always use this so the button
 * itself communicates progress.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    shape = "default",
    loading = false,
    icon,
    disabled,
    className = "",
    children,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={rest.type ?? "button"}
      disabled={disabled || loading}
      className={getButtonClassName({ variant, size, shape, className })}
      {...rest}
    >
      {loading ? (
        <LoadingSpinner size="sm" />
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      <span className="min-w-0 truncate">{children}</span>
    </button>
  );
});
