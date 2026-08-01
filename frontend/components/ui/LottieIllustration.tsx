"use client";

import type { ReactNode } from "react";
import { LottieAnimation } from "@/components/ui/LottieAnimation";
import { lottieSrc, type LottieAssetKey } from "@/lib/lottieAssets";

type LottieIllustrationProps = {
  asset: LottieAssetKey;
  /**
   * Includes size. Default is modal/empty-state scale.
   * Pass a full size class (e.g. `h-10 w-10`) to override - do not mix with the default.
   */
  className?: string;
  ariaLabel?: string;
  fallback?: ReactNode;
};

const DEFAULT_SIZE = "h-28 w-28 sm:h-32 sm:w-32";

/**
 * Typed Lottie by `lottieAssets` key. Prefer this over raw `LottieAnimation` + path strings.
 * Size lives entirely in `className` (default applied only when omitted).
 */
export function LottieIllustration({
  asset,
  className,
  ariaLabel,
  fallback,
}: LottieIllustrationProps) {
  return (
    <LottieAnimation
      src={lottieSrc(asset)}
      className={`mx-auto ${className ?? DEFAULT_SIZE}`.trim()}
      ariaLabel={ariaLabel}
      fallback={fallback}
    />
  );
}
