import type { ReactNode } from "react";

type LandingSectionProps = {
  id?: string;
  children: ReactNode;
  className?: string;
  /** default: max-w-6xl */
  width?: "6xl" | "7xl" | "4xl" | "3xl";
};

const WIDTH_CLASS = {
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
} as const;

export function LandingSection({
  id,
  children,
  className = "",
  width = "6xl",
}: LandingSectionProps) {
  return (
    <section id={id} className={className}>
      <div className={`mx-auto w-full ${WIDTH_CLASS[width]} px-4 sm:px-6 lg:px-12`}>
        {children}
      </div>
    </section>
  );
}
