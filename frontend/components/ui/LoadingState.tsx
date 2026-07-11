"use client";

import { LoadingSpinner, type LoadingSpinnerSize } from "@/components/ui/LoadingSpinner";

export type LoadingStateVariant = "inline" | "centered" | "page";

type LoadingStateProps = {
  label?: string;
  variant?: LoadingStateVariant;
  size?: LoadingSpinnerSize;
  className?: string;
};

const VARIANT_CLASS: Record<LoadingStateVariant, string> = {
  inline: "flex items-center gap-2",
  centered: "flex flex-col items-center justify-center gap-3 py-8 text-center",
  page: "mx-auto flex min-h-[50vh] w-full max-w-md flex-col items-center justify-center gap-4 px-4 py-16 text-center",
};

const LABEL_CLASS: Record<LoadingStateVariant, string> = {
  inline: "text-xs text-neutral-500",
  centered: "text-sm text-neutral-600",
  page: "text-sm text-neutral-600",
};

/** Spinner + optional label for panels, pages, and list/detail loading shells. */
export function LoadingState({
  label = "Loading…",
  variant = "centered",
  size,
  className = "",
}: LoadingStateProps) {
  const spinnerSize = size ?? (variant === "inline" ? "sm" : "lg");

  return (
    <div
      className={`${VARIANT_CLASS[variant]} ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <LoadingSpinner size={spinnerSize} />
      {label ? <p className={LABEL_CLASS[variant]}>{label}</p> : null}
    </div>
  );
}
