"use client";

import type { ReactNode } from "react";
import { LottieIllustration } from "@/components/ui/LottieIllustration";
import { RADIUS } from "@/components/ui/tokens";
import type { EmptyLottieAssetKey } from "@/lib/lottieAssets";
import {
  EMPTY_STATE_ICON_CLASS,
  EMPTY_STATE_VARIANTS,
  type EmptyStateVariant,
} from "@/lib/emptyStateVariants";

export type { EmptyLottieAssetKey } from "@/lib/lottieAssets";
export type { EmptyStateVariant } from "@/lib/emptyStateVariants";

export type EmptyStateProps = {
  icon?: ReactNode;
  /** Decorative Lottie illustration - preferred over `icon` when both are set. */
  lottie?: EmptyLottieAssetKey;
  /** Semantic preset (heart for favorites, calendar for bookings, etc.). Overrides `lottie`/`icon`. */
  variant?: EmptyStateVariant;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

function resolveEmptyVisual(
  variant: EmptyStateVariant | undefined,
  lottie: EmptyLottieAssetKey | undefined,
  icon: ReactNode | undefined,
): ReactNode {
  if (variant) {
    const preset = EMPTY_STATE_VARIANTS[variant];
    if (preset.icon) {
      const Icon = preset.icon;
      return <Icon className={EMPTY_STATE_ICON_CLASS} strokeWidth={1.75} aria-hidden />;
    }
    if (preset.lottie) {
      return <LottieIllustration asset={preset.lottie} ariaLabel="" />;
    }
  }
  if (lottie) {
    return <LottieIllustration asset={lottie} ariaLabel="" />;
  }
  if (icon) {
    return <div className="text-ink-3">{icon}</div>;
  }
  return null;
}

/**
 * Consistent empty-list treatment (bookings, messages, notifications) - a
 * short human sentence plus exactly one next action. Never render a bare
 * "No data" message; every consumer should pass at least a title.
 */
export function EmptyState({
  icon,
  lottie,
  variant,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  const visual = resolveEmptyVisual(variant, lottie, icon);

  return (
    <div
      className={`flex flex-col items-center gap-3 border border-dashed border-line-strong px-6 py-10 text-center ${RADIUS.lg} ${className}`.trim()}
    >
      {visual}
      <p className="font-heading text-base font-semibold text-ink">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm leading-relaxed text-ink-3">{description}</p>
      ) : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
