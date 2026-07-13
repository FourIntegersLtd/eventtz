"use client";

import { useEffect, useState } from "react";
import { HERO_ROTATING_WORDS } from "@/features/landing/landingData";

const HOLD_MS = 2200;
const EXIT_MS = 320;

type Phase = "in" | "out";

export function HeroRotatingWord() {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("in");
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;

    let exitTimer: number | undefined;
    const holdTimer = window.setInterval(() => {
      setPhase("out");
      exitTimer = window.setTimeout(() => {
        setIndex((current) => (current + 1) % HERO_ROTATING_WORDS.length);
        setPhase("in");
      }, EXIT_MS);
    }, HOLD_MS);

    return () => {
      window.clearInterval(holdTimer);
      if (exitTimer) window.clearTimeout(exitTimer);
    };
  }, [reduceMotion]);

  const word = HERO_ROTATING_WORDS[index] ?? HERO_ROTATING_WORDS[0];
  const motionClass =
    phase === "out"
      ? "motion-safe:animate-[hero-word-out_0.32s_ease-in_forwards]"
      : "motion-safe:animate-[hero-word-in_0.45s_ease-out_both]";

  return (
    <span className="relative inline-flex translate-y-[-0.05em] align-baseline pb-[0.28em]">
      <span className="relative inline-block overflow-y-hidden px-0.5">
        <span
          key={`${word}-${phase === "in" ? index : `out-${index}`}`}
          className={`inline-block whitespace-nowrap font-semibold text-primary ${
            reduceMotion ? "" : motionClass
          }`}
        >
          {word}
        </span>
        <span className="sr-only">{word}</span>
      </span>

      {/* Inverted-C arch underline — matches the word width */}
      <svg
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[0.38em] w-full text-primary"
        viewBox="0 0 120 12"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          d="M3 10.5 Q 60 1.5 117 10.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
