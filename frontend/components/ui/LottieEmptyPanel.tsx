"use client";

import { EmptyState, type EmptyLottieAssetKey } from "@/components/ui/EmptyState";

type LottieEmptyPanelProps = {
  title: string;
  description?: string;
  lottie: EmptyLottieAssetKey;
  className?: string;
};

/** Compact empty message with Lottie - for inline search/no-results blocks. */
export function LottieEmptyPanel({ title, description, lottie, className = "" }: LottieEmptyPanelProps) {
  return (
    <EmptyState
      title={title}
      description={description}
      lottie={lottie}
      className={`border-neutral-200 bg-neutral-50 py-8 ${className}`.trim()}
    />
  );
}
