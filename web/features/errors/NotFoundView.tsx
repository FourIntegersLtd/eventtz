"use client";

import { LottieIllustration } from "@/components/ui/LottieIllustration";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { LandingFooter } from "@/features/landing/LandingFooter";
import { LandingNav } from "@/features/landing/LandingNav";
import { LandingSection } from "@/features/landing/LandingSection";
import { landingSectionClass } from "@/features/landing/landingSectionStyles";

/** Public 404: landing nav and footer around a centred message on the page background. */
export function NotFoundView() {
  return (
    <div className="min-h-dvh bg-page-bg text-ink">
      <LandingNav variant="solid" sectionLinkPrefix="/" />
      <main className={landingSectionClass("muted", { bordered: false, extra: "pt-28 sm:pt-32 min-h-[calc(100dvh-8rem)]" })}>
        <LandingSection width="3xl">
          <div className="flex flex-col items-center text-center">
            <LottieIllustration
              asset="notFound"
              className="h-[min(40vh,22rem)] w-[min(40vh,22rem)] max-w-full"
              ariaLabel="Page not found illustration"
            />
            <h1 className="font-heading mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Page not found
            </h1>
            <p className="mt-3 max-w-md text-base leading-relaxed text-ink-2">
              The page you&apos;re looking for doesn&apos;t exist or may have moved.
            </p>
            <ButtonLink href="/" size="lg" className="mt-8">
              Back to home
            </ButtonLink>
          </div>
        </LandingSection>
      </main>
      <LandingFooter sectionLinkPrefix="/" />
    </div>
  );
}
