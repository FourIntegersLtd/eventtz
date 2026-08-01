"use client";

import type { ReactNode } from "react";
import { LottieIllustration } from "@/components/ui/LottieIllustration";
import { RADIUS } from "@/components/ui/tokens";
import type { LottieAssetKey } from "@/lib/lottieAssets";

export type EmptyStateProps = {
  icon?: ReactNode;
  /** Decorative Lottie illustration — preferred over `icon` when both are set. */
  lottie?: LottieAssetKey;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

/**
 * Consistent empty-list treatment (bookings, messages, notifications) — a
 * short human sentence plus exactly one next action. Never render a bare
 * "No data" message; every consumer should pass at least a title.
 */
export function EmptyState({
  icon,
  lottie,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  const visual = lottie ? (
    <LottieIllustration asset={lottie} ariaLabel="" />
  ) : icon ? (
    <div className="text-neutral-400">{icon}</div>
  ) : null;

  return (
    <div
      className={`flex flex-col items-center gap-3 border border-dashed border-neutral-200 px-6 py-10 text-center ${RADIUS.lg} ${className}`.trim()}
    >
      {visual}
      <p className="font-heading text-base font-semibold text-neutral-900">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm leading-relaxed text-neutral-500">{description}</p>
      ) : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
