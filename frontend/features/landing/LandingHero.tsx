"use client";

import Image from "next/image";
import Link from "next/link";
import { getButtonClassName } from "@/components/ui/buttonStyles";
import { HeroMarketplaceSearch } from "@/features/marketplace/HeroMarketplaceSearch";
import {
  HERO_CTA,
  HERO_EYEBROW,
  HERO_HEADLINE,
  HERO_SUBHEADLINE,
} from "@/features/landing/landingData";
import { HeroRotatingWord } from "@/features/landing/HeroRotatingWord";
import { LANDING_HERO_CONTAINER_CLASS } from "@/features/landing/landingSectionStyles";

const HERO_IMAGE_SRC = "/images/landing-images/hero.png";

export function LandingHero() {
  const ctaClass = getButtonClassName({
    variant: "primary",
    shape: "default",
    className:
      "mt-6 inline-flex w-full justify-center px-7 py-3.5 text-base font-semibold sm:mt-8 sm:w-auto",
  });

  return (
    <section className="relative z-30 isolate flex min-h-0 flex-col bg-[#f7f8fc] pt-20 sm:pt-24 lg:min-h-dvh lg:pt-28">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute right-0 top-32 h-64 w-64 rounded-full bg-accent-gold/15 blur-3xl" />
      </div>

      <div
        className={`relative flex flex-1 flex-col justify-start py-6 sm:py-8 lg:justify-center lg:py-10 ${LANDING_HERO_CONTAINER_CLASS}`}
      >
        <div className="grid items-center gap-5 sm:gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-10 xl:gap-14 2xl:gap-16">
          <div className="min-w-0 text-left motion-safe:animate-[hero-copy-in_0.65s_ease-out_both]">
            <p className="flex items-center gap-3 text-sm font-semibold text-primary">
              <span className="inline-block h-px w-8 bg-primary" aria-hidden />
              {HERO_EYEBROW}
            </p>

            <h1 className="font-heading mt-4 text-[1.65rem] font-semibold leading-[1.2] tracking-tight text-neutral-900 sm:mt-5 sm:text-4xl lg:text-[2.85rem] xl:text-5xl">
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

            <Link href={HERO_CTA.href} className={ctaClass}>
              {HERO_CTA.label}
            </Link>
          </div>

          <div className="relative mx-auto w-full max-w-[18rem] motion-safe:animate-[hero-copy-in_0.75s_ease-out_0.08s_both] sm:max-w-md lg:mx-0 lg:max-w-none lg:justify-self-end lg:pl-2 xl:pl-4">
            <div className="relative overflow-hidden rounded-[1.75rem] border border-primary-border/70 bg-white/60 p-1.5 shadow-primary-soft sm:rounded-[2.5rem] sm:p-2.5">
              <Image
                src={HERO_IMAGE_SRC}
                alt="Featured Eventtz vendors — photographer and makeup artist"
                width={900}
                height={900}
                priority
                className="h-auto max-h-[min(34dvh,15rem)] w-full rounded-[1.35rem] object-contain sm:max-h-[min(48dvh,26rem)] sm:rounded-[2rem] lg:max-h-[min(58dvh,34rem)] xl:max-h-[min(62dvh,38rem)]"
              />
            </div>
          </div>
        </div>

        <div className="relative z-20 mx-auto mt-5 w-full min-w-0 max-w-3xl overflow-visible motion-safe:animate-[hero-copy-in_0.75s_ease-out_0.12s_both] sm:mt-10 lg:mt-12 xl:max-w-4xl">
          <HeroMarketplaceSearch variant="landing" submitToPath="/client/browse" />
        </div>
      </div>
    </section>
  );
}
