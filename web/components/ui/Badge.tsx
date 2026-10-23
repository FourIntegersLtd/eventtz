import type { ReactNode } from "react";
import type { Tone } from "@/lib/tone";

export type BadgeProps = {
  /** Semantic colour; defaults to neutral. */
  tone?: Tone;
  className?: string;
  children: ReactNode;
};

/** Pill-shaped status label (`ez-badge--<tone>`). Every status badge in the app is a thin wrapper over this. */
export function Badge({ tone = "neutral", className = "", children }: BadgeProps) {
  return <span className={`ez-badge ez-badge--${tone} shrink-0 ${className}`.trim()}>{children}</span>;
}
