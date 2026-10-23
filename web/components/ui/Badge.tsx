import type { ReactNode } from "react";
import type { Tone } from "@/lib/tone";

export type BadgeProps = {
  /** Semantic colour; defaults to neutral. */
  tone?: Tone;
  /** Drop the leading status dot (`ez-badge--plain`). */
  plain?: boolean;
  className?: string;
  children: ReactNode;
};

/** Pill-shaped status label (`ez-badge--<tone>`). Every status badge in the app is a thin wrapper over this. */
export function Badge({ tone = "neutral", plain = false, className = "", children }: BadgeProps) {
  const plainClass = plain ? "ez-badge--plain " : "";
  return <span className={`ez-badge ez-badge--${tone} shrink-0 ${plainClass}${className}`.trim()}>{children}</span>;
}
