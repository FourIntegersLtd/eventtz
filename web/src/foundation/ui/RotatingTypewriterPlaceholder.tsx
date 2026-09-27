"use client";

/** Animated example text drawn over an empty field. */

import { useEffect, useState } from "react";

const DEFAULT_TYPE_MS = 38;
const DEFAULT_DELETE_MS = 24;
const DEFAULT_HOLD_MS = 1600;

type Phase = "typing" | "holding" | "deleting";

/** Example phrases cycled over an empty field. */
export type RotatingTypewriterPlaceholderProps = {
  examples: readonly string[];
  /** Hide when the user has typed in the field. */
  visible: boolean;
  compact?: boolean;
  /** Positioning and padding for the overlay (parent input should be `relative`). */
  className?: string;
  textClassName?: string;
  /** Vertical alignment inside the field overlay. */
  align?: "center" | "top";
  /** Allow wrapped lines (e.g. textarea overlays) instead of single-line truncate. */
  wrap?: boolean;
  typeMs?: number;
  deleteMs?: number;
  holdMs?: number;
};

/** Types, holds, then deletes each example. Hidden once the field has a value. */
export function RotatingTypewriterPlaceholder({
  examples,
  visible,
  compact = false,
  className = "",
  textClassName = "text-neutral-400",
  align = "center",
  wrap = false,
  typeMs = DEFAULT_TYPE_MS,
  deleteMs = DEFAULT_DELETE_MS,
  holdMs = DEFAULT_HOLD_MS,
}: RotatingTypewriterPlaceholderProps) {
  const [index, setIndex] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [phase, setPhase] = useState<Phase>("typing");
  const [reduceMotion, setReduceMotion] = useState(false);
  const [seenVisible, setSeenVisible] = useState(visible);
  if (visible !== seenVisible) {
    setSeenVisible(visible);
    if (visible) {
      setIndex(0);
      setCharCount(0);
      setPhase("typing");
    }
  }

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!visible || reduceMotion || examples.length === 0) return;

    const example = examples[index] ?? examples[0];
    if (!example) return;
    let timer: number | undefined;

    if (phase === "typing") {
      if (charCount < example.length) {
        timer = window.setTimeout(() => setCharCount((count) => count + 1), typeMs);
      } else {
        timer = window.setTimeout(() => setPhase("holding"), 0);
      }
    } else if (phase === "holding") {
      timer = window.setTimeout(() => setPhase("deleting"), holdMs);
    } else if (phase === "deleting") {
      if (charCount > 0) {
        timer = window.setTimeout(() => setCharCount((count) => count - 1), deleteMs);
      } else {
        timer = window.setTimeout(() => {
          setIndex((current) => (current + 1) % examples.length);
          setPhase("typing");
        }, 0);
      }
    }

    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [visible, reduceMotion, index, charCount, phase, examples, typeMs, deleteMs, holdMs]);

  if (!visible || examples.length === 0) return null;

  const example = examples[index] ?? examples[0];
  if (!example) return null;
  const shown = reduceMotion ? example : example.slice(0, charCount);
  const sizeClass = compact ? "text-sm" : "text-base";
  const alignClass = align === "top" ? "items-start" : "items-center";
  const textWrapClass = wrap
    ? "whitespace-normal leading-relaxed line-clamp-3 pr-3"
    : "truncate";

  return (
    <span
      className={`pointer-events-none absolute inset-y-0 left-0 right-0 flex overflow-hidden ${alignClass} ${sizeClass} ${className}`}
      aria-hidden
    >
      <span className={`block ${textWrapClass} ${textClassName}`}>
        {shown}
        {!reduceMotion ? (
          <span className="ml-0.5 inline-block h-[1.05em] w-px translate-y-[0.12em] bg-neutral-400 align-baseline animate-search-caret" />
        ) : null}
      </span>
    </span>
  );
}
