import type { ReactNode } from "react";
import type { Tone } from "@/lib/tone";

export type BadgeProps = {
  /** Semantic colour; defaults to neutral. */
  tone?: Tone;
  /** Drops the leading status dot (`ez-badge--plain`), for labels that are not a status. */
  plain?: boolean;
  className?: string;
  children: ReactNode;
};

/** Pill-shaped status label (`ez-badge--<tone>`). Every status badge in the app is a thin wrapper over this. */
export function Badge({ tone = "neutral", plain = false, className = "", children }: BadgeProps) {
  return (
    <span className={`ez-badge ez-badge--${tone}${plain ? " ez-badge--plain" : ""} shrink-0 ${className}`.trim()}>{children}</span>
  );
}
