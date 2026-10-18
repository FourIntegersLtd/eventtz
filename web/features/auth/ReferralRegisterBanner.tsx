"use client";

import { Banner } from "@/components/ui/Banner";
import { LottieIllustration } from "@/components/ui/LottieIllustration";

/** "amara-loves" becomes "Amara Loves" when the creator has no display name. */
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
    <Banner
      tone="brand"
      title="Creator referral"
      className={className}
      icon={<LottieIllustration asset="welcome" className="h-10 w-10" ariaLabel="" />}
    >
      You&apos;re joining via <span className="font-semibold text-primary">{creatorName}</span>
    </Banner>
  );
}
