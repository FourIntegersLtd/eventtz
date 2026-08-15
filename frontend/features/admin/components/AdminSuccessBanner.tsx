"use client";

import { LottieIllustration } from "@/components/ui/LottieIllustration";

type AdminSuccessBannerProps = {
  message: string;
};

export function AdminSuccessBanner({ message }: AdminSuccessBannerProps) {
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900"
    >
      <LottieIllustration asset="successCheck" size="inline" ariaLabel="" />
      <p className="whitespace-pre-wrap leading-relaxed">{message}</p>
    </div>
  );
}
