"use client";

import { Loader2 } from "lucide-react";

const SIZE_CLASS = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
} as const;

export type LoadingSpinnerSize = keyof typeof SIZE_CLASS;

type LoadingSpinnerProps = {
  size?: LoadingSpinnerSize;
  className?: string;
};

/** Shared inline spinner — use inside buttons, inputs, and compact rows. */
export function LoadingSpinner({ size = "md", className = "" }: LoadingSpinnerProps) {
  return (
    <Loader2
      className={`animate-spin text-primary ${SIZE_CLASS[size]} ${className}`.trim()}
      aria-hidden
    />
  );
}
