"use client";

import type { ReactNode } from "react";
import { motion, useInView } from "motion/react";
import { useRef } from "react";
import { MOTION } from "@/components/ui/tokens";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";

type MotionRevealProps = {
  children: ReactNode;
  className?: string;
  /** Delay after entering view (seconds). */
  delay?: number;
  /** How much of the element must be visible before animating. */
  amount?: number;
};

/** One-shot fade-up when scrolled into view — landing sections, feature splits. */
export function MotionReveal({
  children,
  className = "",
  delay = 0,
  amount = 0.2,
}: MotionRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = usePrefersReducedMotion();
  const inView = useInView(ref, { once: true, amount });

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      animate={inView || reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
      transition={{
        duration: MOTION.durationStandardMs / 1000,
        delay: reduceMotion ? 0 : delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
