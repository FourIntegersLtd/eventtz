import type { ReactNode } from "react";
import { LANDING_HORIZONTAL_PADDING, LANDING_PAGE_MAX_WIDTH } from "@/features/landing/landingSectionStyles";

type LandingSectionProps = {
  id?: string;
  children: ReactNode;
  className?: string;
  /** default: max-w-7xl — matches nav/hero shell */
  width?: "6xl" | "7xl" | "4xl" | "3xl";
};

const WIDTH_CLASS = {
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "6xl": "max-w-6xl",
  "7xl": LANDING_PAGE_MAX_WIDTH,
} as const;

export function LandingSection({
  id,
  children,
  className = "",
  width = "7xl",
}: LandingSectionProps) {
  return (
    <section id={id} className={className}>
      <div className={`mx-auto w-full ${WIDTH_CLASS[width]} ${LANDING_HORIZONTAL_PADDING}`}>
        {children}
      </div>
    </section>
  );
}
