"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { useRef } from "react";

import { LandingSection } from "@/features/landing/LandingSection";
import {
  LANDING_SCREENSHOT_DEFAULT_HEIGHT,
  LANDING_SCREENSHOT_DEFAULT_WIDTH,
  LANDING_SCREENSHOT_NATURAL_CLASS,
  LANDING_SPLIT_SCREENSHOT_SIZES,
} from "@/features/landing/landingScreenshotConfig";
import {
  LANDING_FEATURE_BODY_CLASS,
  LANDING_FEATURE_HEADLINE_CLASS,
  landingFeatureSectionClass,
  LANDING_NAV_STICKY_TOP_CLASS,
  LANDING_SECTION_BG,
  LANDING_SHOWCASE_MIN_H_CLASS,
  LANDING_SHOWCASE_MIN_H_LG_CLASS,
  LANDING_SHOWCASE_STICKY_TOP_CLASS,
  type LandingSectionTone,
} from "@/features/landing/landingSectionStyles";
import type { LandingScrollFeatureStep } from "@/features/landing/landingData";
import { useLandingScrollSpy } from "@/features/landing/useLandingScrollSpy";

type LandingScrollFeatureShowcaseProps = {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  summary?: string;
  steps: LandingScrollFeatureStep[];
  imageFallbacks?: Partial<Record<string, ReactNode>>;
  tablistAriaLabel?: string;
  tone?: LandingSectionTone;
};

/** Preply-style numbered badge colors for the mobile horizontal carousel. */
const MOBILE_STEP_BADGE_STYLES = [
  "bg-primary-soft text-primary",
  "bg-accent-gold text-ink",
  "bg-accent-violet text-white",
  "bg-primary text-white",
] as const;

const MOBILE_CAROUSEL_SCROLL_CLASS =
  "flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 sm:gap-3 scroll-smooth [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";

function StepScreenshot({
  step,
  fallback,
  visible,
  priority,
  layout = "stacked",
}: {
  step: LandingScrollFeatureStep;
  fallback?: ReactNode;
  visible: boolean;
  priority?: boolean;
  layout?: "stacked" | "inline";
}) {
  const imageClassName =
    layout === "inline"
      ? LANDING_SCREENSHOT_NATURAL_CLASS
      : "h-full w-full object-contain object-center";

  const frame = (
    <div
      className={
        layout === "inline"
          ? "w-full leading-[0]"
          : "h-full w-full leading-[0]"
      }
    >
      {step.imageSrc ? (
        <Image
          src={step.imageSrc}
          alt={step.imageAlt}
          width={LANDING_SCREENSHOT_DEFAULT_WIDTH}
          height={LANDING_SCREENSHOT_DEFAULT_HEIGHT}
          className={imageClassName}
          sizes={LANDING_SPLIT_SCREENSHOT_SIZES}
          priority={priority}
          unoptimized
        />
      ) : (
        fallback
      )}
    </div>
  );

  if (layout === "inline") {
    return frame;
  }

  return (
    <div
      className={`absolute inset-0 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
        visible
          ? "z-10 pointer-events-auto translate-y-0 scale-100 opacity-100"
          : "z-0 pointer-events-none invisible translate-y-3 scale-[0.985] opacity-0"
      }`}
      aria-hidden={!visible}
    >
      {frame}
    </div>
  );
}

function MobileJourneyStepCard({
  step,
  index,
  fallback,
  stepRef,
}: {
  step: LandingScrollFeatureStep;
  index: number;
  fallback?: ReactNode;
  stepRef?: (el: HTMLElement | null) => void;
}) {
  const badgeClass = MOBILE_STEP_BADGE_STYLES[index % MOBILE_STEP_BADGE_STYLES.length];

  return (
    <article
      id={step.id}
      ref={stepRef}
      className="flex w-[min(94vw,30rem)] shrink-0 snap-start flex-col overflow-hidden rounded-card border border-line bg-white shadow-xs sm:w-[min(92vw,32rem)]"
    >
      <div className="p-4 sm:p-5">
        <span
          className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold tabular-nums ${badgeClass}`}
        >
          {index + 1}
        </span>
        <h3 className="mt-2.5 text-base font-semibold leading-snug text-ink sm:mt-3 sm:text-lg">
          {step.title}
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-2 sm:mt-2">
          {step.description}
        </p>
      </div>
      <div className="w-full border-t border-line bg-surface-3">
        <div className="relative aspect-[5/3] w-full overflow-hidden">
          {step.imageSrc ? (
            <Image
              src={step.imageSrc}
              alt={step.imageAlt}
              fill
              className="object-contain object-center"
              sizes="(max-width: 640px) 94vw, 32rem"
              priority={index === 0}
              unoptimized
            />
          ) : (
            fallback
          )}
        </div>
      </div>
    </article>
  );
}

/** KnowHow-style sticky image + scrolling copy; image crossfades per step. */
export function LandingScrollFeatureShowcase({
  id,
  eyebrow,
  title,
  description,
  summary,
  steps,
  imageFallbacks,
  tablistAriaLabel = "Journey steps",
  tone = "white",
}: LandingScrollFeatureShowcaseProps) {
  const carouselRef = useRef<HTMLDivElement>(null);
  const { activeIndex, setMobileStepRef, setDesktopStepRef, scrollToStep } =
    useLandingScrollSpy(steps.length, carouselRef);

  const activeStepId = steps[activeIndex]?.id ?? steps[0]?.id;
  const stickyBarBg = `${LANDING_SECTION_BG[tone]}/95`;
  const sectionCta = steps.find((step) => step.ctaHref && step.ctaLabel);

  return (
    <LandingSection id={id} className={landingFeatureSectionClass(tone)} width="7xl">
      <div className="mx-auto max-w-5xl text-left lg:text-center">
        {eyebrow ? (
          <>
            <h2 className={`${LANDING_FEATURE_HEADLINE_CLASS} text-balance lg:hidden`}>{eyebrow}</h2>
            <p className="hidden text-xs font-semibold uppercase tracking-[0.2em] text-primary lg:block">
              {eyebrow}
            </p>
          </>
        ) : null}
        <h2
          className={`${LANDING_FEATURE_HEADLINE_CLASS} hidden text-balance lg:block ${eyebrow ? "mt-2.5" : ""}`}
        >
          {title}
        </h2>
        {description ? (
          <p className={`${LANDING_FEATURE_BODY_CLASS} mx-auto hidden max-w-3xl text-pretty md:block`}>
            {description}
          </p>
        ) : null}
      </div>

      <div
        className={`z-30 -mx-4 mt-6 flex justify-center py-2 sm:-mx-6 sm:mt-8 lg:mx-0 lg:sticky ${LANDING_NAV_STICKY_TOP_CLASS} lg:py-3 lg:backdrop-blur-md ${stickyBarBg}`}
      >
        {/* Not SegmentedControl: it needs sticky positioning and a mobile underline mode. */}
        <div
          className="flex w-full items-stretch border-b border-line-strong lg:mx-auto lg:max-w-lg lg:gap-0.5 lg:rounded-control lg:border lg:border-line lg:bg-white lg:p-1"
          role="tablist"
          aria-label={tablistAriaLabel}
        >
          {steps.map((step, index) => {
            const active = activeStepId === step.id;
            const StepIcon = step.Icon;
            return (
              <button
                key={step.id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={step.id}
                onClick={() => scrollToStep(index)}
                className={`flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 border-b-2 px-0 py-2.5 text-center text-sm font-semibold leading-tight transition-colors duration-300 motion-reduce:transition-none lg:flex-row lg:gap-1.5 lg:rounded-control lg:border-b-0 lg:px-2 lg:py-2 ${
                  active
                    ? "border-primary text-primary lg:bg-primary lg:text-white lg:shadow-sm"
                    : "border-transparent text-ink-3 hover:text-ink"
                }`}
              >
                <StepIcon
                  className="h-4 w-4 shrink-0 lg:hidden"
                  strokeWidth={2.25}
                  aria-hidden
                />
                <span className="truncate">{step.stepLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-8 lg:hidden">
        <div
          ref={carouselRef}
          className={`-mx-4 px-4 sm:-mx-6 sm:px-6 ${MOBILE_CAROUSEL_SCROLL_CLASS}`}
          aria-label="Booking steps"
        >
          {steps.map((step, index) => (
            <MobileJourneyStepCard
              key={step.id}
              step={step}
              index={index}
              fallback={imageFallbacks?.[step.id]}
              stepRef={setMobileStepRef(index)}
            />
          ))}
        </div>
      </div>

      <div className="mt-4 hidden lg:mt-5 lg:grid lg:grid-cols-[minmax(0,1.55fr)_minmax(0,0.45fr)] lg:gap-6 xl:gap-8">
        <div className="relative hidden lg:block">
          <div className={`sticky ${LANDING_SHOWCASE_STICKY_TOP_CLASS} flex ${LANDING_SHOWCASE_MIN_H_CLASS} w-full items-center`}>
            <div className="relative aspect-[4/3] w-full overflow-hidden">
              {steps.map((step, index) => (
                <StepScreenshot
                  key={step.id}
                  step={step}
                  fallback={imageFallbacks?.[step.id]}
                  visible={activeIndex === index}
                  priority={index === 0}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-0">
          {steps.map((step, index) => {
            const active = activeIndex === index;
            const StepIcon = step.Icon;
            return (
              <article
                key={step.id}
                ref={setDesktopStepRef(index)}
                className={`flex flex-col justify-center border-t border-line py-6 first:border-t-0 first:pt-4 sm:py-10 ${LANDING_SHOWCASE_MIN_H_LG_CLASS} lg:py-0`}
                aria-current={active ? "step" : undefined}
              >
                <p
                  className={`inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] transition-colors duration-500 ${
                    active ? "text-primary" : "text-ink-3"
                  }`}
                >
                  <StepIcon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                  {step.stepLabel}
                </p>
                <h3
                  className={`font-heading mt-3 text-2xl font-semibold leading-tight tracking-tight transition-colors duration-500 sm:text-3xl ${
                    active ? "text-ink" : "text-ink-3"
                  }`}
                >
                  {step.title}
                </h3>
                <p className="mt-4 text-base leading-relaxed text-ink-2 sm:text-lg sm:leading-8">
                  {step.description}
                </p>

                {step.ctaHref && step.ctaLabel ? (
                  <Link
                    href={step.ctaHref}
                    className="mt-8 inline-flex w-fit items-center gap-2 text-base font-semibold text-primary transition hover:opacity-80"
                  >
                    {step.ctaLabel}
                    <ArrowRight className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                  </Link>
                ) : null}
              </article>
            );
          })}
        </div>
      </div>

      {summary ? (
        <p className="mx-auto mt-10 max-w-2xl border-t border-line pt-8 text-center text-sm leading-relaxed text-ink-3 sm:text-base">
          {summary}
        </p>
      ) : null}

      {sectionCta ? (
        <div className={`flex justify-center lg:hidden ${summary ? "mt-6" : "mt-10 border-t border-line pt-8"}`}>
          <Link
            href={sectionCta.ctaHref!}
            className="inline-flex w-fit items-center gap-2 text-base font-semibold text-primary transition hover:opacity-80"
          >
            {sectionCta.ctaLabel}
            <ArrowRight className="h-4 w-4" strokeWidth={2.25} aria-hidden />
          </Link>
        </div>
      ) : null}
    </LandingSection>
  );
}
