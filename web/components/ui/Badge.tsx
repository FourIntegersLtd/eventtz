import type { ReactNode } from "react";
import type { Tone } from "@/lib/tone";

/** Badge tones: the semantic `Tone`s plus the canvas `gold` accent (Badge only; Banner and status metas stay on `Tone`). */
export type BadgeTone = Tone | "gold";

export type BadgeProps = {
  /** Semantic colour, or the canvas `gold` accent; defaults to neutral. */
  tone?: BadgeTone;
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
