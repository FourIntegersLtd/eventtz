"use client";

import { Banner } from "@/components/ui/Banner";
import { LottieIllustration } from "@/components/ui/LottieIllustration";

type AdminSuccessBannerProps = {
  message: string;
};

export function AdminSuccessBanner({ message }: AdminSuccessBannerProps) {
  return (
    <Banner tone="success" icon={<LottieIllustration asset="successCheck" size="inline" ariaLabel="" />}>
      <p className="whitespace-pre-wrap">{message}</p>
    </Banner>
  );
}
