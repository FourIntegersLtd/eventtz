"use client";

import { useEffect, useState } from "react";

/** Syncs with `prefers-reduced-motion: reduce` — use to skip decorative motion/Lottie. */
export function usePrefersReducedMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return reduceMotion;
}
