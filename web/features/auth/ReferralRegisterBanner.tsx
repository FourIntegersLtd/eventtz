"use client";

import { LottieIllustration } from "@/components/ui/LottieIllustration";

function titleCaseSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

type ReferralRegisterBannerProps = {
  displayName: string | null;
  slug: string;
  className?: string;
};

/** Creator referral callout inside the register form. */
export function ReferralRegisterBanner({ displayName, slug, className = "" }: ReferralRegisterBannerProps) {
  const creatorName = displayName?.trim() || titleCaseSlug(slug);

  return (
    <div
      className={`rounded-2xl bg-gradient-to-br from-primary/12 via-primary/[0.07] to-amber-50/90 px-4 py-4 text-center ring-2 ring-primary/25 sm:px-5 sm:py-5 ${className}`.trim()}
      role="status"
      aria-live="polite"
    >
      <LottieIllustration asset="welcome" className="mx-auto h-20 w-20 sm:h-24 sm:w-24" ariaLabel="" />
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-primary">Creator referral</p>
      <p className="mt-1 font-heading text-lg font-semibold leading-snug text-neutral-900 sm:text-xl">
        You&apos;re joining via <span className="text-primary">{creatorName}</span>
      </p>
    </div>
  );
}
