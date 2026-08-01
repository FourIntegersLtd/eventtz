"use client";

import { LottieFailureInline } from "@/components/ui/LottieFailureInline";

type AdminErrorBannerProps = {
  message: string;
};

export function AdminErrorBanner({ message }: AdminErrorBannerProps) {
  return <LottieFailureInline message={message} />;
}
