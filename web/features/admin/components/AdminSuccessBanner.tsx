"use client";

import { LottieIllustration } from "@/components/ui/LottieIllustration";

type AdminSuccessBannerProps = {
  message: string;
};

export function AdminSuccessBanner({ message }: AdminSuccessBannerProps) {
  return (
    <div role="status" className="ez-banner ez-banner--success">
      <LottieIllustration asset="successCheck" size="inline" ariaLabel="" />
      <div className="ez-banner__body">
        <p className="whitespace-pre-wrap">{message}</p>
      </div>
    </div>
  );
}
