"use client";

import { Loader2 } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { FOCUS_RING, RADIUS } from "@/components/ui/tokens";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
export type ButtonSize = "sm" | "md";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Icon-only or icon+label leading element. */
  icon?: React.ReactNode;
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white hover:opacity-95 disabled:opacity-50",
  secondary:
    "border border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50 disabled:opacity-50",
  ghost: "text-neutral-700 hover:bg-neutral-100 disabled:opacity-50",
  destructive: "bg-red-600 text-white hover:bg-red-700 disabled:opacity-50",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
};

/**
 * Base button primitive for the signed-in portal. Every variant carries a
 * press state (active:scale) and, when `loading`, replaces its label with an
 * inline spinner rather than blocking behind a separate overlay — async
 * actions (accept/decline/pay/submit) should always use this so the button
 * itself communicates progress.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, icon, disabled, className = "", children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={rest.type ?? "button"}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 ${RADIUS.md} font-semibold transition ${MOTION_PRESS} ${FOCUS_RING} ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`.trim()}
      {...rest}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      <span className="min-w-0 truncate">{children}</span>
    </button>
  );
});

const MOTION_PRESS = "duration-150 ease-out active:scale-[0.97]";
