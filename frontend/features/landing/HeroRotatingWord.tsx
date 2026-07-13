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
    <span className="relative inline-flex min-w-0 max-w-full translate-y-[-0.05em] align-baseline overflow-hidden">
      <span className="invisible whitespace-nowrap font-semibold" aria-hidden>
        makeup artists
      </span>
      <span className="sr-only">{word}</span>
      <span
        className="absolute inset-0 flex items-center overflow-hidden"
        aria-hidden
      >
        <span
          key={`${word}-${phase === "in" ? index : `out-${index}`}`}
          className={`whitespace-nowrap font-semibold text-primary underline decoration-primary/35 decoration-2 underline-offset-[0.18em] ${
            reduceMotion ? "" : motionClass
          }`}
        >
          {word}
        </span>
      </span>
    </span>
  );
}
