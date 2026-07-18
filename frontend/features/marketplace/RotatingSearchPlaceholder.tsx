"use client";

import { useEffect, useState } from "react";

const TYPE_MS = 38;
const DELETE_MS = 24;
const HOLD_MS = 1600;

const SEARCH_PLACEHOLDER_EXAMPLES = [
  "puff-puff vendor in Leeds",
  "Help me plan my 30th birthday",
  "small chops caterer in Manchester",
  "wedding cake baker in London",
  "photographer for a naming ceremony",
  "Help me select vendors for my wedding",
] as const;

type Phase = "typing" | "holding" | "deleting";

type RotatingSearchPlaceholderProps = {
  visible: boolean;
  /** Slightly smaller text on the browse (non-landing) search bar. */
  compact?: boolean;
};

export function RotatingSearchPlaceholder({
  visible,
  compact = false,
}: RotatingSearchPlaceholderProps) {
  const [index, setIndex] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [phase, setPhase] = useState<Phase>("typing");
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Reset when the field becomes empty again (placeholder reappears).
  useEffect(() => {
    if (!visible) return;
    setIndex(0);
    setCharCount(0);
    setPhase("typing");
  }, [visible]);

  useEffect(() => {
    if (!visible || reduceMotion) return;

    const example = SEARCH_PLACEHOLDER_EXAMPLES[index] ?? SEARCH_PLACEHOLDER_EXAMPLES[0];
    let timer: number | undefined;

    if (phase === "typing") {
      if (charCount < example.length) {
        timer = window.setTimeout(() => setCharCount((n) => n + 1), TYPE_MS);
      } else {
        timer = window.setTimeout(() => setPhase("holding"), 0);
      }
    } else if (phase === "holding") {
      timer = window.setTimeout(() => setPhase("deleting"), HOLD_MS);
    } else if (phase === "deleting") {
      if (charCount > 0) {
        timer = window.setTimeout(() => setCharCount((n) => n - 1), DELETE_MS);
      } else {
        timer = window.setTimeout(() => {
          setIndex((current) => (current + 1) % SEARCH_PLACEHOLDER_EXAMPLES.length);
          setPhase("typing");
        }, 0);
      }
    }

    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [visible, reduceMotion, index, charCount, phase]);

  if (!visible) return null;

  const example =
    SEARCH_PLACEHOLDER_EXAMPLES[index] ?? SEARCH_PLACEHOLDER_EXAMPLES[0];
  const shown = reduceMotion ? example : example.slice(0, charCount);

  return (
    <span
      className={`pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center overflow-hidden pl-11 pr-4 ${
        compact ? "pl-10 text-sm" : "text-base"
      }`}
      aria-hidden
    >
      <span className="block truncate text-neutral-400">
        {shown}
        {!reduceMotion ? (
          <span className="ml-0.5 inline-block h-[1.05em] w-px translate-y-[0.12em] bg-neutral-400 align-baseline animate-search-caret" />
        ) : null}
      </span>
    </span>
  );
}
