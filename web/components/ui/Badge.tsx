import type { ReactNode } from "react";
import { TONE } from "@/components/ui/tokens";
import type { Tone } from "@/lib/tone";

export type BadgeProps = {
  /** Semantic colour; defaults to neutral. */
  tone?: Tone;
  className?: string;
  children: ReactNode;
};

/** Pill-shaped status label. Every status badge in the app is a thin wrapper over this. */
export function Badge({ tone = "neutral", className = "", children }: BadgeProps) {
  const toneClasses = TONE[tone];
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${toneClasses.text} ${toneClasses.background} ${toneClasses.line} ${className}`.trim()}
    >
      {children}
    </span>
  );
}
