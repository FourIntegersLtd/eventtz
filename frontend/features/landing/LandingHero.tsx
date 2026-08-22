"use client";

import Image from "next/image";
import Link from "next/link";
import { getButtonClassName } from "@/components/ui/buttonStyles";
import { HeroMarketplaceSearch } from "@/features/marketplace/HeroMarketplaceSearch";
import {
  HERO_CTA,
  HERO_HEADLINE,
  HERO_SUBHEADLINE,
} from "@/features/landing/landingData";
import { HeroRotatingWord } from "@/features/landing/HeroRotatingWord";
import { LANDING_HERO_CONTAINER_CLASS } from "@/features/landing/landingSectionStyles";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";

const HERO_IMAGE_SRC = "/images/landing-images/hero.png";
const HERO_IMAGE_WIDTH = 1402;
const HERO_IMAGE_HEIGHT = 1122;

export function LandingHero() {
  return (
    <section className="relative z-30 isolate flex min-h-dvh flex-col bg-[#f7f8fc] pt-20 sm:pt-24 lg:pt-28">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute right-0 top-32 h-64 w-64 rounded-full bg-accent-gold/15 blur-3xl" />
      </div>

      <div
        className={`relative flex min-h-0 flex-1 flex-col justify-between py-6 sm:py-8 lg:justify-center lg:py-10 ${LANDING_HERO_CONTAINER_CLASS}`}
      >
        <div className="grid min-h-0 flex-1 grid-cols-1 items-center gap-4 sm:gap-6 lg:flex-none lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-10 xl:gap-14 2xl:gap-16">
          <div className="min-w-0 text-left motion-safe:animate-[hero-copy-in_0.65s_ease-out_both]">
            <h1 className="font-heading text-[1.65rem] font-semibold leading-[1.2] tracking-tight text-neutral-900 sm:text-4xl lg:text-[2.85rem] xl:text-5xl">
              {HERO_HEADLINE.lead}{" "}
              <span className="inline-flex max-w-full flex-wrap items-baseline gap-x-2 gap-y-1 md:flex-nowrap md:gap-x-3">
                {HERO_HEADLINE.sticky} <HeroRotatingWord />
              </span>
            </h1>

            <p className="mt-4 max-w-xl text-base leading-relaxed text-neutral-600 sm:mt-5 sm:text-lg">
              {HERO_SUBHEADLINE.lead}
              <span className="font-semibold text-primary">{HERO_SUBHEADLINE.accent}</span>
              {HERO_SUBHEADLINE.tail}
            </p>

            <div className="mt-6 hidden lg:block">
              <Link
                href={HERO_CTA.href}
                className={getButtonClassName({
                  variant: "primary",
                  shape: "default",
                  className:
                    "w-full justify-center px-7 py-3.5 text-base font-semibold lg:w-auto",
                })}
                onClick={() =>
                  track(MixpanelEvents.landing_cta_clicked, {
                    cta: "browse",
                    location: "hero",
                  })
                }
              >
                {HERO_CTA.label}
              </Link>
            </div>
          </div>

          <div className="relative mx-auto flex w-full max-w-full flex-1 items-center justify-center motion-safe:animate-[hero-copy-in_0.75s_ease-out_0.08s_both] lg:mx-0 lg:flex-none lg:max-w-none lg:justify-self-end lg:pl-2 xl:pl-4">
            <Image
              src={HERO_IMAGE_SRC}
              alt="Featured Eventtz vendors - photographer and makeup artist"
              width={HERO_IMAGE_WIDTH}
              height={HERO_IMAGE_HEIGHT}
              priority
              unoptimized
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="block h-auto max-h-[min(44dvh,22rem)] w-full bg-transparent object-contain sm:max-h-[min(48dvh,26rem)] lg:max-h-[min(50dvh,28rem)] xl:max-h-[min(54dvh,32rem)]"
            />
          </div>
        </div>

        <div className="relative z-20 mx-auto w-full min-w-0 max-w-3xl shrink-0 overflow-visible motion-safe:animate-[hero-copy-in_0.75s_ease-out_0.12s_both] pt-4 lg:mt-12 lg:pt-0 xl:max-w-4xl">
          <p className="mb-2 flex flex-wrap items-center gap-2 text-sm text-neutral-600">
            <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold tracking-wide text-primary">
              AI-powered
            </span>
          </p>
          <HeroMarketplaceSearch variant="landing" submitToPath="/client/browse" />
        </div>
      </div>
    </section>
  );
}
