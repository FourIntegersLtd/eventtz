"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import type { LottieAssetKey } from "@/lib/lottieAssets";

type LottieEmptyPanelProps = {
  title: string;
  description?: string;
  lottie: LottieAssetKey;
  className?: string;
};

/** Compact empty message with Lottie — for inline search/no-results blocks. */
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
