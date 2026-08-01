"use client";

import { LottieIllustration } from "@/components/ui/LottieIllustration";

type LottieFailureInlineProps = {
  message: string;
  className?: string;
};

/** Compact inline error row — form errors, fetch failures in panels. */
export function LottieFailureInline({ message, className = "" }: LottieFailureInlineProps) {
  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900 ${className}`.trim()}
    >
      <LottieIllustration asset="failure" className="h-10 w-10 shrink-0" ariaLabel="" />
      <p className="whitespace-pre-wrap leading-relaxed">{message}</p>
    </div>
  );
}
