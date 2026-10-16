import Image from "next/image";
import type { ReactNode } from "react";

import { LANDING_SCREENSHOT_FRAME_CLASS } from "@/features/landing/LandingFeatureSplit";
import {
  LANDING_SCREENSHOT_DEFAULT_HEIGHT,
  LANDING_SCREENSHOT_DEFAULT_WIDTH,
} from "@/features/landing/landingScreenshotConfig";

type LandingScreenshotFrameProps = {
  /** When set, shows a real screenshot from public/. Otherwise renders `fallback`. */
  imageSrc?: string;
  imageAlt: string;
  fallback?: ReactNode;
  className?: string;
  /** `marketing` = full bleed (e.g. Pika export with browser chrome). `app` = simple in-app frame. */
  variant?: "app" | "marketing";
};

/** Product screenshot wrapper for landing sections. */
export function LandingScreenshotFrame({
  imageSrc,
  imageAlt,
  fallback,
  className = "",
  variant = "app",
}: LandingScreenshotFrameProps) {
  if (variant === "marketing" && imageSrc) {
    return (
      <div className={`rounded-2xl ${LANDING_SCREENSHOT_FRAME_CLASS} ${className}`.trim()}>
        <Image
          src={imageSrc}
          alt={imageAlt}
          width={LANDING_SCREENSHOT_DEFAULT_WIDTH}
          height={LANDING_SCREENSHOT_DEFAULT_HEIGHT}
          className="h-auto w-full"
          sizes="(max-width: 1024px) 100vw, 960px"
          priority
          unoptimized
        />
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl ${LANDING_SCREENSHOT_FRAME_CLASS} shadow-[0_24px_60px_-24px_rgba(45,37,32,0.28)] ${className}`}
    >
      <div className="flex items-center gap-1.5 border-b border-primary-border/60 bg-neutral-50 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400/90" aria-hidden />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/90" aria-hidden />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/90" aria-hidden />
      </div>
      <div className="relative bg-white">
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt={imageAlt}
            width={LANDING_SCREENSHOT_DEFAULT_WIDTH}
            height={LANDING_SCREENSHOT_DEFAULT_HEIGHT}
            className="h-auto w-full"
            sizes="(max-width: 1024px) 90vw, 360px"
            unoptimized
          />
        ) : (
          fallback
        )}
      </div>
    </div>
  );
}
