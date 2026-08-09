"use client";

import { EmptyState, type EmptyLottieAssetKey, type EmptyStateVariant } from "@/components/ui/EmptyState";

type LottieEmptyPanelProps = {
  title: string;
  description?: string;
  lottie?: EmptyLottieAssetKey;
  variant?: EmptyStateVariant;
  className?: string;
};

/** Compact empty message with illustration - for inline search/no-results blocks. */
export function LottieEmptyPanel({
  title,
  description,
  lottie,
  variant,
  className = "",
}: LottieEmptyPanelProps) {
  return (
    <EmptyState
      title={title}
      description={description}
      lottie={lottie}
      variant={variant}
      className={`border-neutral-200 bg-neutral-50 py-8 ${className}`.trim()}
    />
  );
}
