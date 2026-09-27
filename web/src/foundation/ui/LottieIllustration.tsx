"use client";

/** Lottie player addressed by a stable asset key and a size preset. */

import type { ReactNode } from "react";
import { LottieAnimation } from "@/foundation/ui/LottieAnimation";
import { lottieSrc, type LottieAssetKey } from "@/foundation/ui/lottieAssets";

type LottieIllustrationProps = {
  asset: LottieAssetKey;
  /**
   * Preset scale for common UI moments. Ignored when `className` is set.
   * - inline: compact row/banner errors
   * - status: auth outcomes, confirm dialogs, success/failure moments
   * - feature: panels, modals, empty states (default)
   * - hero: landing / large empty states
   */
  size?: LottieIllustrationSize;
  /**
   * Layout/spacing extras (e.g. `mb-3`, `shrink-0`). Size comes from `size`; pass
   * explicit `h-* w-*` here only when you need a one-off dimension override.
   */
  className?: string;
  ariaLabel?: string;
  fallback?: ReactNode;
};

/** Preset scale for `LottieIllustration`. */
export type LottieIllustrationSize = "inline" | "status" | "feature" | "hero";

/** Tailwind size classes for each `LottieIllustrationSize`. */
export const LOTTIE_ILLUSTRATION_SIZE_CLASS: Record<LottieIllustrationSize, string> = {
  inline: "h-12 w-12 shrink-0",
  status: "h-32 w-32 sm:h-36 sm:w-36",
  feature: "h-28 w-28 sm:h-32 sm:w-32",
  hero: "h-36 w-36 sm:h-44 sm:w-44",
};

/**
 * Typed Lottie by `lottieAssets` key. Prefer this over raw `LottieAnimation` + path strings.
 * Use `size` for consistent scales; pass `className` only when you need layout extras or a custom size.
 */
export function LottieIllustration({
  asset,
  size = "feature",
  className,
  ariaLabel,
  fallback,
}: LottieIllustrationProps) {
  const hasDimensionOverride =
    Boolean(className?.includes("h-")) && Boolean(className?.includes("w-"));
  const dimensionClass = hasDimensionOverride ? "" : LOTTIE_ILLUSTRATION_SIZE_CLASS[size];
  return (
    <LottieAnimation
      src={lottieSrc(asset)}
      className={["mx-auto", dimensionClass, className].filter(Boolean).join(" ")}
      ariaLabel={ariaLabel}
      fallback={fallback}
    />
  );
}
