"use client";

import type { ReactNode } from "react";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingNav } from "@/components/landing/LandingNav";
import { LANDING_NAV_OFFSET_CLASS } from "@/components/landing/landingSectionStyles";

type BlogSiteChromeProps = {
  children: ReactNode;
};

/** Public blog frame: the same solid landing nav and footer as the home page, on the page background. */
export function BlogSiteChrome({ children }: BlogSiteChromeProps) {
  return (
    <div className="min-h-dvh bg-page-bg text-ink">
      <LandingNav variant="solid" sectionLinkPrefix="/" />
      <main className={LANDING_NAV_OFFSET_CLASS}>{children}</main>
      <LandingFooter sectionLinkPrefix="/" />
    </div>
  );
}
