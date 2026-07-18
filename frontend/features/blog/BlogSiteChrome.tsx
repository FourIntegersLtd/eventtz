"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { EventtzLogo } from "@/components/branding/EventtzLogo";
import { LandingFooter } from "@/features/landing/LandingFooter";

type BlogSiteChromeProps = {
  children: ReactNode;
};

export function BlogSiteChrome({ children }: BlogSiteChromeProps) {
  return (
    <div className="min-h-dvh bg-[linear-gradient(180deg,#faf8fc_0%,#f3eef9_42%,#faf8fc_100%)] text-neutral-900">
      <header className="sticky top-0 z-40 border-b border-primary-border/50 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-2.5 lg:px-8">
          <EventtzLogo
            href="/"
            variant="header"
            imageClassName="h-9 w-auto sm:h-10 md:h-11"
            width={200}
            height={72}
            priority
            className="inline-flex shrink-0 items-center"
          />
          <nav className="flex items-center gap-4 text-sm font-medium text-neutral-700">
            <Link href="/blog" className="transition hover:text-primary">
              Blog
            </Link>
            <Link href="/explore" className="transition hover:text-primary">
              Explore
            </Link>
            <Link href="/" className="transition hover:text-primary">
              Home
            </Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <LandingFooter sectionLinkPrefix="/" />
    </div>
  );
}
