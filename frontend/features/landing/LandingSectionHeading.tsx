import type { ReactNode } from "react";

type LandingSectionHeadingProps = {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  align?: "center" | "left";
  className?: string;
};

/** Consistent eyebrow + heading pattern used across landing sections — one accent color, no per-section gradients. */
export function LandingSectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  className = "",
}: LandingSectionHeadingProps) {
  const isCenter = align === "center";
  return (
    <div className={`${isCenter ? "mx-auto text-center" : "text-left"} max-w-2xl ${className}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
      <h2 className="font-heading mt-2.5 text-xl font-semibold tracking-tight text-primary sm:text-3xl md:text-4xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-3 text-sm leading-relaxed text-accent-violet/90 sm:text-base">{description}</p>
      ) : null}
    </div>
  );
}
