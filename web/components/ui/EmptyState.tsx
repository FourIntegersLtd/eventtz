"use client";

import type { ReactNode } from "react";
import { LottieIllustration } from "@/components/ui/LottieIllustration";
import type { EmptyLottieAssetKey } from "@/lib/lottieAssets";
import { EMPTY_STATE_VARIANTS, type EmptyStateVariant } from "@/lib/emptyStateVariants";

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

/** The illustration: a Lottie as is, an icon inside the canvas `ez-empty__art` disc. */
function resolveEmptyVisual(
  variant: EmptyStateVariant | undefined,
  lottie: EmptyLottieAssetKey | undefined,
  icon: ReactNode | undefined,
): ReactNode {
  if (variant) {
    const preset = EMPTY_STATE_VARIANTS[variant];
    if (preset.icon) {
      const Icon = preset.icon;
      return (
        <div className="ez-empty__art">
          <Icon strokeWidth={1.75} aria-hidden />
        </div>
      );
    }
    if (preset.lottie) {
      return <LottieIllustration asset={preset.lottie} ariaLabel="" />;
    }
  }
  if (lottie) {
    return <LottieIllustration asset={lottie} ariaLabel="" />;
  }
  if (icon) {
    return <div className="ez-empty__art">{icon}</div>;
  }
  return null;
}

/**
 * Consistent empty-list treatment (`ez-empty`: bookings, messages, notifications) - a
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
    <div className={`ez-empty ${className}`.trim()}>
      {visual}
      <h3 className="ez-h2">{title}</h3>
      {description ? <p className="ez-body">{description}</p> : null}
      {action ? <div>{action}</div> : null}
    </div>
  );
}
