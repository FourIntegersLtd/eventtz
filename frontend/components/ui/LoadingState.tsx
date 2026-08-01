"use client";

import { LottieAnimation } from "@/components/ui/LottieAnimation";
import { LoadingSpinner, type LoadingSpinnerSize } from "@/components/ui/LoadingSpinner";
import { lottieSrc, type LottieAssetKey } from "@/lib/lottieAssets";

export type LoadingStateVariant = "inline" | "centered" | "page";

type LoadingStateProps = {
  label?: string;
  variant?: LoadingStateVariant;
  size?: LoadingSpinnerSize;
  className?: string;
  /** When true, centered/page variants show the branded Lottie loader instead of a spinner. */
  branded?: boolean;
  /** Override the default branded loader animation. */
  lottie?: LottieAssetKey;
};

const VARIANT_CLASS: Record<LoadingStateVariant, string> = {
  inline: "flex items-center gap-2",
  centered: "flex flex-col items-center justify-center gap-3 py-8 text-center",
  page: "mx-auto flex min-h-[50vh] w-full max-w-md flex-col items-center justify-center gap-4 px-4 py-16 text-center",
};

const LABEL_CLASS: Record<LoadingStateVariant, string> = {
  inline: "text-xs text-neutral-500",
  centered: "text-sm text-neutral-600",
  page: "text-sm text-neutral-600",
};

/** Spinner or branded Lottie + optional label for panels, pages, and list/detail loading shells. */
export function LoadingState({
  label = "Loading…",
  variant = "centered",
  size,
  className = "",
  branded = false,
  lottie,
}: LoadingStateProps) {
  const spinnerSize = size ?? (variant === "inline" ? "sm" : "lg");
  const showLottie = (branded || lottie) && variant !== "inline";
  const lottieAsset = lottie ?? "loading";

  return (
    <div
      className={`${VARIANT_CLASS[variant]} ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      {showLottie ? (
        <LottieAnimation
          src={lottieSrc(lottieAsset)}
          className="h-20 w-20 sm:h-24 sm:w-24"
          ariaLabel={label}
        />
      ) : (
        <LoadingSpinner size={spinnerSize} />
      )}
      {label ? <p className={LABEL_CLASS[variant]}>{label}</p> : null}
    </div>
  );
}
