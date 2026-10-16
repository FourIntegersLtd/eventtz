"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { MOTION } from "@/components/ui/tokens";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";

type MotionStaggerItemProps = {
  index?: number;
  children: ReactNode;
  className?: string;
  as?: "div" | "li";
  /** Index-based delay. Set false for chat bubbles / one-shot fades. Default true. */
  stagger?: boolean;
};

/** Staggered entrance for list/grid items - dashboards, cards, feeds. */
export function MotionStaggerItem({
  index = 0,
  children,
  className = "",
  as = "div",
  stagger = true,
}: MotionStaggerItemProps) {
  const reduceMotion = usePrefersReducedMotion();
  const Tag = as === "li" ? motion.li : motion.div;

  return (
    <Tag
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: MOTION.durationStandardMs / 1000,
        delay: reduceMotion || !stagger ? 0 : Math.min(index, 12) * 0.05,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </Tag>
  );
}
