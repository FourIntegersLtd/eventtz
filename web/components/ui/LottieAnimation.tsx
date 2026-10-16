"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";

const DotLottieReact = dynamic(
  () => import("@lottiefiles/dotlottie-react").then((m) => m.DotLottieReact),
  { ssr: false },
);

export type LottieAnimationProps = {
  /** Path under `public/` (e.g. `/animations/foo.json`) or remote `.json` / `.lottie` URL. */
  src: string;
  loop?: boolean;
  autoplay?: boolean;
  className?: string;
  /** Shown when `prefers-reduced-motion: reduce` or while the player loads. */
  fallback?: ReactNode;
  /** Accessible name when the animation is decorative. */
  ariaLabel?: string;
};

/**
 * Renders a Lottie or dotLottie animation via `@lottiefiles/dotlottie-react`.
 * Respects reduced-motion and skips SSR (canvas player).
 */
export function LottieAnimation({
  src,
  loop = true,
  autoplay = true,
  className = "",
  fallback = null,
  ariaLabel,
}: LottieAnimationProps) {
  const reduceMotion = usePrefersReducedMotion();

  if (reduceMotion) {
    return fallback ? <div className={className}>{fallback}</div> : null;
  }

  return (
    <div
      className={className}
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
    >
      <DotLottieReact src={src} loop={loop} autoplay={autoplay} />
    </div>
  );
}
