"use client";

import type { ReactNode } from "react";

type Props = {
  index: number;
  children: ReactNode;
  className?: string;
};

const STAGGER_MS = 80;

export function AnimatedStepItem({ index, children, className = "" }: Props) {
  return (
    <div
      className={`animate-onboarding-step-in ${className}`.trim()}
      style={{ animationDelay: `${index * STAGGER_MS}ms` }}
    >
      {children}
    </div>
  );
}
