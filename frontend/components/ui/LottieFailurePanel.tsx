"use client";

import type { ReactNode } from "react";
import { LottieIllustration } from "@/components/ui/LottieIllustration";
import { RADIUS } from "@/components/ui/tokens";

type LottieFailurePanelProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

/** Error / failure moment — failed payment, declined booking, sync errors. */
export function LottieFailurePanel({
  title,
  description,
  action,
  className = "",
}: LottieFailurePanelProps) {
  return (
    <div
      className={`flex flex-col items-center gap-3 border border-red-200 bg-red-50 px-6 py-8 text-center ${RADIUS.lg} ${className}`.trim()}
      role="alert"
    >
      <LottieIllustration asset="failure" className="h-24 w-24 sm:h-28 sm:w-28" ariaLabel="" />
      <p className="font-heading text-base font-semibold text-red-950">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm leading-relaxed text-red-800/90">{description}</p>
      ) : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
